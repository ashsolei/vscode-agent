import * as vscode from 'vscode';
import { BaseAgent } from '../agents/base-agent';

/**
 * Hälsostatus för en agent.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'disabled' | 'unknown';

/**
 * Hälsodata per agent.
 */
export interface AgentHealthData {
  agentId: string;
  agentName: string;
  status: HealthStatus;
  /** Totalt antal anrop */
  totalCalls: number;
  /** Lyckade anrop */
  successCount: number;
  /** Misslyckade anrop */
  failureCount: number;
  /** Framgångsgrad (0-1) */
  successRate: number;
  /** Genomsnittlig svarstid i ms */
  avgResponseMs: number;
  /** P95 svarstid i ms */
  p95ResponseMs: number;
  /** Senaste aktivitet */
  lastActivity: number;
  /** Senaste fel */
  lastError?: string;
  /** Konsekutiva misslyckanden */
  consecutiveFailures: number;
  /** Om agenten är manuellt pausad */
  paused: boolean;
}

/**
 * Konfiguration för hälsomonitorn.
 */
export interface HealthMonitorConfig {
  /** Tröskelvärde för degraded (framgångsgrad under detta → degraded) */
  degradedThreshold: number;
  /** Tröskelvärde för unhealthy (framgångsgrad under detta → unhealthy) */
  unhealthyThreshold: number;
  /** Antal konsekutiva fel innan auto-disable */
  autoDisableAfterFailures: number;
  /** Aktivera auto-disable */
  autoDisableEnabled: boolean;
  /** Antal datapunkter att behålla per agent */
  maxDataPoints: number;
  /** Intervall för hälsokontroll i ms (0 = manuellt) */
  checkIntervalMs: number;
}

/** Intern datapunkt */
interface DataPoint {
  timestamp: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * AgentHealthMonitor — övervakar agenthälsa i realtid.
 * Spårar framgångsgrad, svarstider, och kan auto-disabla ohälsosamma agenter.
 */
export class AgentHealthMonitor implements vscode.Disposable {
  private config: HealthMonitorConfig;
  private dataPoints = new Map<string, DataPoint[]>();
  private agentNames = new Map<string, string>();
  private pausedAgents = new Set<string>();
  private consecutiveFailures = new Map<string, number>();
  private intervalHandle: ReturnType<typeof setInterval> | undefined;

  private readonly _onStatusChange = new vscode.EventEmitter<{ agentId: string; from: HealthStatus; to: HealthStatus }>();
  readonly onStatusChange = this._onStatusChange.event;

  private readonly _onAgentDisabled = new vscode.EventEmitter<{ agentId: string; reason: string }>();
  readonly onAgentDisabled = this._onAgentDisabled.event;

  private previousStatus = new Map<string, HealthStatus>();

  constructor(config?: Partial<HealthMonitorConfig>) {
    this.config = {
      degradedThreshold: config?.degradedThreshold ?? 0.8,
      unhealthyThreshold: config?.unhealthyThreshold ?? 0.5,
      autoDisableAfterFailures: config?.autoDisableAfterFailures ?? 5,
      autoDisableEnabled: config?.autoDisableEnabled ?? false,
      maxDataPoints: config?.maxDataPoints ?? 100,
      checkIntervalMs: config?.checkIntervalMs ?? 0,
    };

    if (this.config.checkIntervalMs > 0) {
      this.intervalHandle = setInterval(() => this.runHealthCheck(), this.config.checkIntervalMs);
    }
  }

  /** Uppdatera konfiguration */
  updateConfig(config: Partial<HealthMonitorConfig>): void {
    this.config = { ...this.config, ...config };

    // Uppdatera interval om det ändrats
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    if (this.config.checkIntervalMs > 0) {
      this.intervalHandle = setInterval(() => this.runHealthCheck(), this.config.checkIntervalMs);
    }
  }

  /**
   * Registrera en agent för övervakning.
   */
  registerAgent(agent: BaseAgent): void {
    this.agentNames.set(agent.id, agent.name);
    if (!this.dataPoints.has(agent.id)) {
      this.dataPoints.set(agent.id, []);
    }
  }

  /**
   * Rapportera ett lyckat anrop.
   */
  recordSuccess(agentId: string, durationMs: number): void {
    this.addDataPoint(agentId, { timestamp: Date.now(), durationMs, success: true });
    this.consecutiveFailures.set(agentId, 0);
    this.checkStatusChange(agentId);
  }

  /**
   * Rapportera ett misslyckat anrop.
   */
  recordFailure(agentId: string, durationMs: number, error?: string): void {
    this.addDataPoint(agentId, { timestamp: Date.now(), durationMs, success: false, error });
    const failures = (this.consecutiveFailures.get(agentId) ?? 0) + 1;
    this.consecutiveFailures.set(agentId, failures);

    // Auto-disable vid för många konsekutiva fel
    if (this.config.autoDisableEnabled && failures >= this.config.autoDisableAfterFailures) {
      this.pauseAgent(agentId, `Auto-disabled efter ${failures} konsekutiva misslyckanden`);
    }

    this.checkStatusChange(agentId);
  }

  /**
   * Hämta hälsodata för en specifik agent.
   */
  getHealth(agentId: string): AgentHealthData {
    const points = this.dataPoints.get(agentId) ?? [];
    const name = this.agentNames.get(agentId) ?? agentId;

    if (points.length === 0) {
      return {
        agentId,
        agentName: name,
        status: this.pausedAgents.has(agentId) ? 'disabled' : 'unknown',
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        avgResponseMs: 0,
        p95ResponseMs: 0,
        lastActivity: 0,
        consecutiveFailures: this.consecutiveFailures.get(agentId) ?? 0,
        paused: this.pausedAgents.has(agentId),
      };
    }

    const successCount = points.filter((p) => p.success).length;
    const failureCount = points.length - successCount;
    const successRate = points.length > 0 ? successCount / points.length : 0;
    const durations = points.map((p) => p.durationMs).sort((a, b) => a - b);
    const avgResponseMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95Index = Math.floor(durations.length * 0.95);
    const p95ResponseMs = durations[p95Index] ?? durations[durations.length - 1];
    const lastActivity = points[points.length - 1].timestamp;
    const lastFailure = [...points].reverse().find((p) => !p.success);

    return {
      agentId,
      agentName: name,
      status: this.calculateStatus(agentId, successRate),
      totalCalls: points.length,
      successCount,
      failureCount,
      successRate,
      avgResponseMs,
      p95ResponseMs,
      lastActivity,
      lastError: lastFailure?.error,
      consecutiveFailures: this.consecutiveFailures.get(agentId) ?? 0,
      paused: this.pausedAgents.has(agentId),
    };
  }

  /**
   * Hämta hälsodata för alla övervakade agenter.
   */
  getAllHealth(): AgentHealthData[] {
    const agentIds = new Set([...this.dataPoints.keys(), ...this.agentNames.keys()]);
    return [...agentIds].map((id) => this.getHealth(id));
  }

  /**
   * Pausa en agent (stoppa routing till den).
   */
  pauseAgent(agentId: string, reason?: string): void {
    this.pausedAgents.add(agentId);
    this._onAgentDisabled.fire({ agentId, reason: reason ?? 'Manuellt pausad' });
    this.checkStatusChange(agentId);
  }

  /**
   * Återaktivera en pausad agent.
   */
  resumeAgent(agentId: string): void {
    this.pausedAgents.delete(agentId);
    this.consecutiveFailures.set(agentId, 0);
    this.checkStatusChange(agentId);
  }

  /**
   * Kontrollera om en agent är pausad.
   */
  isPaused(agentId: string): boolean {
    return this.pausedAgents.has(agentId);
  }

  /**
   * Generera en hälsorapport som markdown-dokument.
   */
  async showHealthReport(): Promise<void> {
    const healthData = this.getAllHealth()
      .sort((a, b) => {
        const statusOrder: Record<HealthStatus, number> = { unhealthy: 0, degraded: 1, disabled: 2, unknown: 3, healthy: 4 };
        return statusOrder[a.status] - statusOrder[b.status];
      });

    const statusEmoji: Record<HealthStatus, string> = {
      healthy: '🟢',
      degraded: '🟡',
      unhealthy: '🔴',
      disabled: '⏸️',
      unknown: '⚪',
    };

    const lines = [
      '# 🏥 Agent Health Report\n',
      `*Genererad: ${new Date().toLocaleString()}*\n`,
      '## Översikt\n',
      `| Status | Agent | Framgång | Snitt (ms) | P95 (ms) | Anrop | Konsek. fel |`,
      `| --- | --- | --- | --- | --- | --- | --- |`,
    ];

    for (const h of healthData) {
      const emoji = statusEmoji[h.status];
      lines.push(
        `| ${emoji} ${h.status} | ${h.agentName} | ${(h.successRate * 100).toFixed(1)}% | ${h.avgResponseMs.toFixed(0)} | ${h.p95ResponseMs.toFixed(0)} | ${h.totalCalls} | ${h.consecutiveFailures} |`
      );
    }

    // Sammanfattning
    const total = healthData.reduce((s, h) => s + h.totalCalls, 0);
    const totalSuccess = healthData.reduce((s, h) => s + h.successCount, 0);
    const unhealthy = healthData.filter((h) => h.status === 'unhealthy' || h.status === 'disabled');

    lines.push('');
    lines.push('## Sammanfattning\n');
    lines.push(`- **Totala anrop:** ${total}`);
    lines.push(`- **Total framgångsgrad:** ${total > 0 ? ((totalSuccess / total) * 100).toFixed(1) : '0'}%`);
    lines.push(`- **Övervakade agenter:** ${healthData.length}`);
    lines.push(`- **Friska agenter:** ${healthData.filter((h) => h.status === 'healthy').length}`);
    lines.push(`- **Degraderade:** ${healthData.filter((h) => h.status === 'degraded').length}`);
    lines.push(`- **Ohälsosamma/Disabled:** ${unhealthy.length}`);

    if (unhealthy.length > 0) {
      lines.push('');
      lines.push('## ⚠️ Agenter med problem\n');
      for (const h of unhealthy) {
        lines.push(`### ${h.agentName} (${h.status})`);
        lines.push(`- Konsekutiva fel: ${h.consecutiveFailures}`);
        lines.push(`- Framgångsgrad: ${(h.successRate * 100).toFixed(1)}%`);
        if (h.lastError) {
          lines.push(`- Senaste fel: ${h.lastError}`);
        }
        lines.push('');
      }
    }

    const doc = await vscode.workspace.openTextDocument({
      content: lines.join('\n'),
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Kör en hälsokontroll — kontrollerar alla agenters status.
   */
  runHealthCheck(): Array<{ agentId: string; status: HealthStatus; alert?: string }> {
    const results: Array<{ agentId: string; status: HealthStatus; alert?: string }> = [];

    for (const agentId of this.dataPoints.keys()) {
      const health = this.getHealth(agentId);
      let alert: string | undefined;

      if (health.status === 'unhealthy') {
        alert = `Agent "${health.agentName}" är ohälsosam (${(health.successRate * 100).toFixed(0)}% framgång)`;
      } else if (health.status === 'degraded') {
        alert = `Agent "${health.agentName}" är degraderad (${(health.successRate * 100).toFixed(0)}% framgång)`;
      }

      results.push({ agentId, status: health.status, alert });
    }

    return results;
  }

  /**
   * Återställ data för en agent.
   */
  resetAgent(agentId: string): void {
    this.dataPoints.set(agentId, []);
    this.consecutiveFailures.set(agentId, 0);
    this.pausedAgents.delete(agentId);
    this.previousStatus.delete(agentId);
    this.checkStatusChange(agentId);
  }

  /**
   * Återställ all data.
   */
  resetAll(): void {
    this.dataPoints.clear();
    this.consecutiveFailures.clear();
    this.pausedAgents.clear();
    this.previousStatus.clear();
  }

  // ─── Privata helpers ──────────────────────

  private addDataPoint(agentId: string, point: DataPoint): void {
    if (!this.dataPoints.has(agentId)) {
      this.dataPoints.set(agentId, []);
    }
    const points = this.dataPoints.get(agentId)!;
    points.push(point);
    if (points.length > this.config.maxDataPoints) {
      points.splice(0, points.length - this.config.maxDataPoints);
    }
  }

  private calculateStatus(agentId: string, successRate: number): HealthStatus {
    if (this.pausedAgents.has(agentId)) { return 'disabled'; }
    if (successRate < this.config.unhealthyThreshold) { return 'unhealthy'; }
    if (successRate < this.config.degradedThreshold) { return 'degraded'; }
    return 'healthy';
  }

  private checkStatusChange(agentId: string): void {
    const health = this.getHealth(agentId);
    const previous = this.previousStatus.get(agentId);
    if (previous && previous !== health.status) {
      this._onStatusChange.fire({ agentId, from: previous, to: health.status });
    }
    this.previousStatus.set(agentId, health.status);
  }

  dispose(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
    this._onStatusChange.dispose();
    this._onAgentDisabled.dispose();
  }
}
