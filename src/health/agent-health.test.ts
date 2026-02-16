import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentHealthMonitor, HealthStatus } from './agent-health';
import { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';

// ─── Helpers ──────────────────────────────────

class StubAgent extends BaseAgent {
  constructor(id: string, name?: string) {
    super(id, name ?? id, `${id} agent`);
  }
  async handle(_ctx: AgentContext): Promise<AgentResult> {
    return {};
  }
}

// ─── Tests ────────────────────────────────────

describe('AgentHealthMonitor', () => {
  let monitor: AgentHealthMonitor;

  beforeEach(() => {
    monitor = new AgentHealthMonitor();
  });

  afterEach(() => {
    monitor.dispose();
  });

  describe('constructor & config', () => {
    it('skapar med standardkonfiguration', () => {
      const m = new AgentHealthMonitor();
      expect(m).toBeDefined();
      m.dispose();
    });

    it('accepterar partiell konfiguration', () => {
      const m = new AgentHealthMonitor({ degradedThreshold: 0.9, autoDisableEnabled: true });
      expect(m).toBeDefined();
      m.dispose();
    });

    it('startar intervall med checkIntervalMs', () => {
      vi.useFakeTimers();
      const m = new AgentHealthMonitor({ checkIntervalMs: 1000 });
      const agent = new StubAgent('a', 'A');
      m.registerAgent(agent);
      m.recordSuccess('a', 100);

      vi.advanceTimersByTime(1500);
      m.dispose();
      vi.useRealTimers();
    });
  });

  describe('registerAgent', () => {
    it('registrerar en agent', () => {
      const agent = new StubAgent('code', 'Code Agent');
      monitor.registerAgent(agent);
      const health = monitor.getHealth('code');
      expect(health.agentName).toBe('Code Agent');
      expect(health.status).toBe('unknown');
      expect(health.totalCalls).toBe(0);
    });

    it('registrerar flera agenter', () => {
      monitor.registerAgent(new StubAgent('a', 'A'));
      monitor.registerAgent(new StubAgent('b', 'B'));
      const all = monitor.getAllHealth();
      expect(all).toHaveLength(2);
    });
  });

  describe('recordSuccess', () => {
    it('registrerar lyckat anrop', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.recordSuccess('a', 100);
      const health = monitor.getHealth('a');
      expect(health.totalCalls).toBe(1);
      expect(health.successCount).toBe(1);
      expect(health.failureCount).toBe(0);
      expect(health.successRate).toBe(1);
      expect(health.status).toBe('healthy');
    });

    it('registrerar flera lyckade anrop', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.recordSuccess('a', 100);
      monitor.recordSuccess('a', 200);
      monitor.recordSuccess('a', 300);
      const health = monitor.getHealth('a');
      expect(health.totalCalls).toBe(3);
      expect(health.avgResponseMs).toBe(200);
    });

    it('nollställer konsekutiva fel', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.recordFailure('a', 100, 'err');
      monitor.recordFailure('a', 100, 'err');
      monitor.recordSuccess('a', 100);
      expect(monitor.getHealth('a').consecutiveFailures).toBe(0);
    });
  });

  describe('recordFailure', () => {
    it('registrerar misslyckat anrop', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.recordFailure('a', 100, 'Network error');
      const health = monitor.getHealth('a');
      expect(health.failureCount).toBe(1);
      expect(health.successRate).toBe(0);
      expect(health.lastError).toBe('Network error');
      expect(health.consecutiveFailures).toBe(1);
    });

    it('räknar konsekutiva fel', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.recordFailure('a', 100, 'e1');
      monitor.recordFailure('a', 100, 'e2');
      monitor.recordFailure('a', 100, 'e3');
      expect(monitor.getHealth('a').consecutiveFailures).toBe(3);
    });

    it('auto-disable vid konfigurerade konsekutiva fel', () => {
      const m = new AgentHealthMonitor({ autoDisableEnabled: true, autoDisableAfterFailures: 3 });
      m.registerAgent(new StubAgent('a'));
      const cb = vi.fn();
      m.onAgentDisabled(cb);

      m.recordFailure('a', 100, 'err');
      m.recordFailure('a', 100, 'err');
      expect(m.isPaused('a')).toBe(false);

      m.recordFailure('a', 100, 'err');
      expect(m.isPaused('a')).toBe(true);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'a' }));
      m.dispose();
    });

    it('auto-disable inte aktiv utan flagga', () => {
      // autoDisableEnabled = false (default)
      monitor.registerAgent(new StubAgent('a'));
      for (let i = 0; i < 10; i++) {
        monitor.recordFailure('a', 100, 'err');
      }
      expect(monitor.isPaused('a')).toBe(false);
    });
  });

  describe('getHealth', () => {
    it('returnerar unknown status för oregistrerad agent', () => {
      const health = monitor.getHealth('nonexistent');
      expect(health.status).toBe('unknown');
      expect(health.agentName).toBe('nonexistent');
    });

    it('beräknar korrekt p95', () => {
      monitor.registerAgent(new StubAgent('a'));
      // 20 datapunkter med ökande svarstid
      for (let i = 1; i <= 20; i++) {
        monitor.recordSuccess('a', i * 10);
      }
      const health = monitor.getHealth('a');
      // P95 index = floor(20 * 0.95) = 19, sorterade: 10,20,...,200 → index 19 = 200
      expect(health.p95ResponseMs).toBeGreaterThanOrEqual(190);
    });

    it('returnerar disabled status för pausad agent utan data', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.pauseAgent('a');
      expect(monitor.getHealth('a').status).toBe('disabled');
    });
  });

  describe('status beräkning', () => {
    it('healthy vid hög framgångsgrad', () => {
      monitor.registerAgent(new StubAgent('a'));
      for (let i = 0; i < 10; i++) {
        monitor.recordSuccess('a', 100);
      }
      expect(monitor.getHealth('a').status).toBe('healthy');
    });

    it('degraded vid medel framgångsgrad', () => {
      // Default degradedThreshold=0.8, unhealthyThreshold=0.5
      monitor.registerAgent(new StubAgent('a'));
      // 7 success, 3 fail → 70% → degraded
      for (let i = 0; i < 7; i++) { monitor.recordSuccess('a', 100); }
      for (let i = 0; i < 3; i++) { monitor.recordFailure('a', 100); }
      expect(monitor.getHealth('a').status).toBe('degraded');
    });

    it('unhealthy vid låg framgångsgrad', () => {
      monitor.registerAgent(new StubAgent('a'));
      // 3 success, 7 fail → 30% → unhealthy
      for (let i = 0; i < 3; i++) { monitor.recordSuccess('a', 100); }
      for (let i = 0; i < 7; i++) { monitor.recordFailure('a', 100); }
      expect(monitor.getHealth('a').status).toBe('unhealthy');
    });

    it('disabled övertrumfar andra statusar', () => {
      monitor.registerAgent(new StubAgent('a'));
      for (let i = 0; i < 10; i++) { monitor.recordSuccess('a', 100); }
      monitor.pauseAgent('a');
      expect(monitor.getHealth('a').status).toBe('disabled');
    });

    it('respekterar anpassade tröskelvärden', () => {
      const m = new AgentHealthMonitor({ degradedThreshold: 0.95, unhealthyThreshold: 0.7 });
      m.registerAgent(new StubAgent('a'));
      // 8 success, 2 fail → 80% → degraded (under 0.95)
      for (let i = 0; i < 8; i++) { m.recordSuccess('a', 100); }
      for (let i = 0; i < 2; i++) { m.recordFailure('a', 100); }
      expect(m.getHealth('a').status).toBe('degraded');
      m.dispose();
    });
  });

  describe('getAllHealth', () => {
    it('returnerar alla agenter', () => {
      monitor.registerAgent(new StubAgent('a', 'A'));
      monitor.registerAgent(new StubAgent('b', 'B'));
      monitor.recordSuccess('a', 100);
      expect(monitor.getAllHealth()).toHaveLength(2);
    });

    it('inkluderar agenter med bara registrering', () => {
      monitor.registerAgent(new StubAgent('a'));
      const all = monitor.getAllHealth();
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe('unknown');
    });

    it('inkluderar agenter med data utan registrering', () => {
      // recordSuccess skapar dataPoints utan registerAgent
      monitor.recordSuccess('unregistered', 100);
      const all = monitor.getAllHealth();
      expect(all).toHaveLength(1);
      expect(all[0].agentName).toBe('unregistered');
    });
  });

  describe('pauseAgent & resumeAgent', () => {
    it('pausar en agent', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.pauseAgent('a');
      expect(monitor.isPaused('a')).toBe(true);
    });

    it('emittar onAgentDisabled', () => {
      const cb = vi.fn();
      monitor.onAgentDisabled(cb);
      monitor.registerAgent(new StubAgent('a'));
      monitor.pauseAgent('a', 'test reason');
      expect(cb).toHaveBeenCalledWith({ agentId: 'a', reason: 'test reason' });
    });

    it('emittar onAgentDisabled med standardmeddelande', () => {
      const cb = vi.fn();
      monitor.onAgentDisabled(cb);
      monitor.registerAgent(new StubAgent('a'));
      monitor.pauseAgent('a');
      expect(cb).toHaveBeenCalledWith({ agentId: 'a', reason: 'Manuellt pausad' });
    });

    it('återaktiverar en agent', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.pauseAgent('a');
      expect(monitor.isPaused('a')).toBe(true);
      monitor.resumeAgent('a');
      expect(monitor.isPaused('a')).toBe(false);
    });

    it('nollställer konsekutiva fel vid resume', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.recordFailure('a', 100);
      monitor.recordFailure('a', 100);
      monitor.pauseAgent('a');
      monitor.resumeAgent('a');
      expect(monitor.getHealth('a').consecutiveFailures).toBe(0);
    });
  });

  describe('onStatusChange', () => {
    it('emittar vid statusändring', () => {
      const cb = vi.fn();
      monitor.onStatusChange(cb);
      monitor.registerAgent(new StubAgent('a'));

      // Första success → unknown → healthy
      monitor.recordSuccess('a', 100);
      // unknown → healthy, men previousStatus var inte satt så inget emit
      // Nu har previousStatus satts till healthy

      // Gör den unhealthy
      for (let i = 0; i < 10; i++) {
        monitor.recordFailure('a', 100);
      }

      expect(cb).toHaveBeenCalled();
      const call = cb.mock.calls.find(
        (c: any) => c[0].to === 'unhealthy'
      );
      expect(call).toBeDefined();
    });

    it('emittar inte vid samma status', () => {
      const cb = vi.fn();
      monitor.onStatusChange(cb);
      monitor.registerAgent(new StubAgent('a'));

      monitor.recordSuccess('a', 100);
      monitor.recordSuccess('a', 100);
      monitor.recordSuccess('a', 100);

      // Alla är healthy — efter den första sätts previousStatus
      // Efterföljande calls ändrar inte status → inget emit (utom möjligen den andra)
      const healthyToHealthyChanges = cb.mock.calls.filter(
        (c: any) => c[0].from === 'healthy' && c[0].to === 'healthy'
      );
      expect(healthyToHealthyChanges).toHaveLength(0);
    });
  });

  describe('showHealthReport', () => {
    it('öppnar ett markdown-dokument', async () => {
      const vsc = await import('vscode');
      monitor.registerAgent(new StubAgent('a', 'Agent A'));
      monitor.recordSuccess('a', 100);
      monitor.recordFailure('a', 200, 'test error');

      await monitor.showHealthReport();
      expect(vsc.workspace.openTextDocument).toHaveBeenCalled();
      expect(vsc.window.showTextDocument).toHaveBeenCalled();
    });

    it('visar ohälsosamma agenter i problemsektion', async () => {
      const vsc = await import('vscode');
      // Rensa mock-anrop från tidigare test
      (vsc.workspace.openTextDocument as ReturnType<typeof vi.fn>).mockClear();

      const m = new AgentHealthMonitor();
      m.registerAgent(new StubAgent('a', 'Agent A'));
      // Gör unhealthy (0% success → under unhealthyThreshold=0.5)
      for (let i = 0; i < 10; i++) {
        m.recordFailure('a', 100, 'error');
      }

      await m.showHealthReport();
      const args = (vsc.workspace.openTextDocument as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(args.content).toContain('Agenter med problem');
      m.dispose();
    });
  });

  describe('runHealthCheck', () => {
    it('returnerar resultat för alla agenter', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.registerAgent(new StubAgent('b'));
      monitor.recordSuccess('a', 100);
      monitor.recordSuccess('b', 100);

      const results = monitor.runHealthCheck();
      expect(results).toHaveLength(2);
    });

    it('inkluderar alert för unhealthy', () => {
      monitor.registerAgent(new StubAgent('a', 'Agent A'));
      for (let i = 0; i < 10; i++) {
        monitor.recordFailure('a', 100);
      }

      const results = monitor.runHealthCheck();
      expect(results[0].status).toBe('unhealthy');
      expect(results[0].alert).toContain('ohälsosam');
    });

    it('inkluderar alert för degraded', () => {
      monitor.registerAgent(new StubAgent('a', 'Agent A'));
      // 7 success, 3 fail → 70%
      for (let i = 0; i < 7; i++) { monitor.recordSuccess('a', 100); }
      for (let i = 0; i < 3; i++) { monitor.recordFailure('a', 100); }

      const results = monitor.runHealthCheck();
      expect(results[0].status).toBe('degraded');
      expect(results[0].alert).toContain('degraderad');
    });

    it('inga alerts för healthy', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.recordSuccess('a', 100);

      const results = monitor.runHealthCheck();
      expect(results[0].alert).toBeUndefined();
    });
  });

  describe('resetAgent', () => {
    it('nollställer data för en agent', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.recordSuccess('a', 100);
      monitor.recordFailure('a', 200);
      monitor.pauseAgent('a');

      monitor.resetAgent('a');
      const health = monitor.getHealth('a');
      expect(health.totalCalls).toBe(0);
      expect(health.consecutiveFailures).toBe(0);
      expect(health.paused).toBe(false);
    });
  });

  describe('resetAll', () => {
    it('nollställer all data men behåller agentnamn', () => {
      monitor.registerAgent(new StubAgent('a'));
      monitor.registerAgent(new StubAgent('b'));
      monitor.recordSuccess('a', 100);
      monitor.recordFailure('b', 100);
      monitor.pauseAgent('b');

      monitor.resetAll();
      // agentNames bevaras, men data nollställs
      const all = monitor.getAllHealth();
      for (const h of all) {
        expect(h.totalCalls).toBe(0);
        expect(h.consecutiveFailures).toBe(0);
        expect(h.paused).toBe(false);
      }
    });
  });

  describe('updateConfig', () => {
    it('uppdaterar konfiguration', () => {
      monitor.registerAgent(new StubAgent('a'));
      // 9 success + 1 fail → 90%
      for (let i = 0; i < 9; i++) { monitor.recordSuccess('a', 100); }
      monitor.recordFailure('a', 100);

      // Med degradedThreshold=0.8 → healthy
      expect(monitor.getHealth('a').status).toBe('healthy');

      // Uppdatera till striktare tröskelvärde
      monitor.updateConfig({ degradedThreshold: 0.95 });
      // Nu 90% < 0.95 → degraded
      expect(monitor.getHealth('a').status).toBe('degraded');
    });
  });

  describe('maxDataPoints trimning', () => {
    it('trimmar gamla datapunkter', () => {
      const m = new AgentHealthMonitor({ maxDataPoints: 5 });
      m.registerAgent(new StubAgent('a'));
      for (let i = 0; i < 10; i++) {
        m.recordSuccess('a', 100);
      }
      expect(m.getHealth('a').totalCalls).toBe(5);
      m.dispose();
    });
  });

  describe('dispose', () => {
    it('rensar intervall', () => {
      vi.useFakeTimers();
      const m = new AgentHealthMonitor({ checkIntervalMs: 1000 });
      expect(() => m.dispose()).not.toThrow();
      vi.useRealTimers();
    });

    it('kan disponeras utan fel', () => {
      expect(() => monitor.dispose()).not.toThrow();
    });
  });
});
