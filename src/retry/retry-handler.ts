import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';
import { Middleware, MiddlewareInfo } from '../middleware';

/**
 * Konfiguration för retry och fallback.
 */
export interface RetryConfig {
  /** Max antal retry-försök (default: 2) */
  maxRetries: number;
  /** Initial fördröjning i ms (default: 500) */
  initialDelayMs: number;
  /** Multiplikator för exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** Max fördröjning i ms (default: 5000) */
  maxDelayMs: number;
  /** Feltyper som ska triggra retry (tom = alla) */
  retryableErrors: string[];
  /** Timeout per försök i ms (0 = ingen timeout) */
  timeoutMs: number;
}

/**
 * Fallback-konfiguration — vilka agenter att falla tillbaka på.
 */
export interface FallbackConfig {
  /** Map: agentId → lista av fallback-agenter i prioritetsordning */
  fallbacks: Map<string, string[]>;
  /** Om true, notifiera användaren vid fallback */
  notifyOnFallback: boolean;
}

/**
 * Resultat av ett retry/fallback-försök.
 */
export interface RetryAttempt {
  agentId: string;
  attempt: number;
  success: boolean;
  durationMs: number;
  error?: string;
  usedFallback: boolean;
}

/**
 * AgentRetryHandler — hanterar automatisk retry med exponential backoff
 * och fallback till alternativa agenter vid misslyckande.
 */
export class AgentRetryHandler implements vscode.Disposable {
  private config: RetryConfig;
  private fallbackConfig: FallbackConfig;
  private history: RetryAttempt[] = [];
  private readonly _onDidRetry = new vscode.EventEmitter<RetryAttempt>();
  readonly onDidRetry = this._onDidRetry.event;

  static readonly MAX_HISTORY = 200;

  constructor(
    config?: Partial<RetryConfig>,
    fallbackConfig?: Partial<FallbackConfig>
  ) {
    this.config = {
      maxRetries: config?.maxRetries ?? 2,
      initialDelayMs: config?.initialDelayMs ?? 500,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      maxDelayMs: config?.maxDelayMs ?? 5000,
      retryableErrors: config?.retryableErrors ?? [],
      timeoutMs: config?.timeoutMs ?? 0,
    };
    this.fallbackConfig = {
      fallbacks: fallbackConfig?.fallbacks ?? new Map(),
      notifyOnFallback: fallbackConfig?.notifyOnFallback ?? true,
    };
  }

  /** Uppdatera retry-konfiguration */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Uppdatera fallback-konfiguration */
  updateFallbacks(fallbacks: Map<string, string[]>): void {
    this.fallbackConfig.fallbacks = fallbacks;
  }

  /** Registrera fallback för en specifik agent */
  setFallback(agentId: string, fallbackIds: string[]): void {
    this.fallbackConfig.fallbacks.set(agentId, fallbackIds);
  }

  /** Ta bort fallback */
  removeFallback(agentId: string): void {
    this.fallbackConfig.fallbacks.delete(agentId);
  }

  /** Hämta fallbacks för en agent */
  getFallbacks(agentId: string): string[] {
    return this.fallbackConfig.fallbacks.get(agentId) ?? [];
  }

  /**
   * Kör en agent med retry-logik.
   * Om alla försök misslyckas, prova fallback-agenter.
   */
  async executeWithRetry(
    agent: BaseAgent,
    ctx: AgentContext,
    getAgent?: (id: string) => BaseAgent | undefined
  ): Promise<{ result: AgentResult; attempts: RetryAttempt[] }> {
    const attempts: RetryAttempt[] = [];

    // Försök primär agent
    const primaryResult = await this.tryAgent(agent, ctx, attempts);
    if (primaryResult) {
      return { result: primaryResult, attempts };
    }

    // Primär agent misslyckades — prova fallbacks
    if (getAgent) {
      const fallbackIds = this.getFallbacks(agent.id);
      for (const fbId of fallbackIds) {
        const fbAgent = getAgent(fbId);
        if (!fbAgent) { continue; }

        if (this.fallbackConfig.notifyOnFallback) {
          ctx.stream.progress(`🔄 Primär agent "${agent.name}" misslyckades. Provar fallback: ${fbAgent.name}...`);
        }

        const fbResult = await this.tryAgent(fbAgent, ctx, attempts, true);
        if (fbResult) {
          return { result: fbResult, attempts };
        }
      }
    }

    // Allt misslyckades
    const lastError = attempts[attempts.length - 1]?.error ?? 'Okänt fel';
    throw new AgentRetryError(
      `Alla försök misslyckades för agent "${agent.id}" (${attempts.length} försök). Senaste: ${lastError}`,
      attempts
    );
  }

  /**
   * Prova en agent med retry upp till maxRetries.
   * Returnerar resultat om lyckas, undefined om alla försök misslyckas.
   */
  private async tryAgent(
    agent: BaseAgent,
    ctx: AgentContext,
    attempts: RetryAttempt[],
    isFallback = false
  ): Promise<AgentResult | undefined> {
    let delay = this.config.initialDelayMs;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (ctx.token.isCancellationRequested) {
        break;
      }

      const start = Date.now();

      try {
        const result = await this.executeWithTimeout(agent, ctx);
        const record: RetryAttempt = {
          agentId: agent.id,
          attempt: attempt + 1,
          success: true,
          durationMs: Date.now() - start,
          usedFallback: isFallback,
        };
        attempts.push(record);
        this.recordAttempt(record);
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const record: RetryAttempt = {
          agentId: agent.id,
          attempt: attempt + 1,
          success: false,
          durationMs: Date.now() - start,
          error: errorMsg,
          usedFallback: isFallback,
        };
        attempts.push(record);
        this.recordAttempt(record);

        // Kontrollera om felet ska trigga retry
        if (!this.isRetryable(errorMsg)) {
          break;
        }

        // Vänta med exponential backoff innan nästa försök
        if (attempt < this.config.maxRetries) {
          ctx.stream.progress(
            `⏳ Retry ${attempt + 1}/${this.config.maxRetries} för ${agent.name} (väntar ${delay}ms)...`
          );
          await this.sleep(delay);
          delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelayMs);
        }
      }
    }

    return undefined;
  }

  /** Kör agent med valfri timeout */
  private async executeWithTimeout(
    agent: BaseAgent,
    ctx: AgentContext
  ): Promise<AgentResult> {
    if (this.config.timeoutMs <= 0) {
      return agent.handle(ctx);
    }

    return Promise.race([
      agent.handle(ctx),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout efter ${this.config.timeoutMs}ms`)), this.config.timeoutMs)
      ),
    ]);
  }

  /** Kontrollera om felet är retryable */
  private isRetryable(errorMsg: string): boolean {
    if (this.config.retryableErrors.length === 0) {
      return true; // Alla fel är retryable om ingen lista anges
    }
    return this.config.retryableErrors.some((pattern) =>
      errorMsg.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /** Registrera försök i historiken */
  private recordAttempt(attempt: RetryAttempt): void {
    this.history.push(attempt);
    if (this.history.length > AgentRetryHandler.MAX_HISTORY) {
      this.history = this.history.slice(-AgentRetryHandler.MAX_HISTORY);
    }
    this._onDidRetry.fire(attempt);
  }

  /** Vänta ms */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Statistik ──────────────────────────────

  /** Hämta statistik per agent */
  stats(): RetryStats {
    const byAgent: Record<string, { total: number; successes: number; failures: number; retries: number; avgDurationMs: number; fallbacksUsed: number }> = {};

    for (const a of this.history) {
      if (!byAgent[a.agentId]) {
        byAgent[a.agentId] = { total: 0, successes: 0, failures: 0, retries: 0, avgDurationMs: 0, fallbacksUsed: 0 };
      }
      const s = byAgent[a.agentId];
      s.total++;
      if (a.success) { s.successes++; }
      else { s.failures++; }
      if (a.attempt > 1) { s.retries++; }
      if (a.usedFallback) { s.fallbacksUsed++; }
      s.avgDurationMs = s.avgDurationMs + (a.durationMs - s.avgDurationMs) / s.total;
    }

    return {
      totalAttempts: this.history.length,
      successRate: this.history.length > 0
        ? this.history.filter((a) => a.success).length / this.history.length
        : 0,
      byAgent,
    };
  }

  /** Aktuell konfiguration */
  get currentConfig(): Readonly<RetryConfig> {
    return { ...this.config };
  }

  /** Aktuella fallbacks */
  get currentFallbacks(): ReadonlyMap<string, string[]> {
    return this.fallbackConfig.fallbacks;
  }

  /** Senaste försökens historik */
  getHistory(limit?: number): RetryAttempt[] {
    const h = [...this.history];
    return limit ? h.slice(-limit) : h;
  }

  /** Rensa historik */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Skapa en middleware som integrerar retry-logik i pipeline.
   * OBS: Denna middleware fångar fel och hanterar retry — den bör ha låg prioritet (hög nummer).
   */
  createMiddleware(getAgent?: (id: string) => BaseAgent | undefined): Middleware {
    return {
      name: 'retry-fallback',
      priority: 200, // Kör efter alla andra middlewares
      onError: async (info: MiddlewareInfo) => {
        const errorMsg = info.error?.message ?? '';
        if (!this.isRetryable(errorMsg)) {
          return; // Låt felet propagera
        }

        // Flagga att retry pågår — undvik dubbel retry
        if (info.meta['retryHandled']) { return; }
        info.meta['retryHandled'] = true;

        try {
          const { result } = await this.executeWithRetry(
            info.agent,
            info.ctx,
            getAgent
          );
          // Spara resultatet för pipeline
          info.result = result;
          info.error = undefined;
        } catch {
          // Retry misslyckades — originella felet propagerar
        }
      },
    };
  }

  dispose(): void {
    this._onDidRetry.dispose();
  }
}

/**
 * Specialiserat fel som innehåller retry-historik.
 */
export class AgentRetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: RetryAttempt[]
  ) {
    super(message);
    this.name = 'AgentRetryError';
  }
}

/**
 * Statistik från retry-systemet.
 */
export interface RetryStats {
  totalAttempts: number;
  successRate: number;
  byAgent: Record<string, {
    total: number;
    successes: number;
    failures: number;
    retries: number;
    avgDurationMs: number;
    fallbacksUsed: number;
  }>;
}
