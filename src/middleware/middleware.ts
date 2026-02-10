import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';

/**
 * Information som skickas till middleware-hooks.
 */
export interface MiddlewareInfo {
  agent: BaseAgent;
  ctx: AgentContext;
  startTime: number;
  /** Satt efter exekvering */
  endTime?: number;
  /** Satt efter exekvering */
  result?: AgentResult;
  /** Satt om agenten kastar ett undantag */
  error?: Error;
  /** Extra metadata som middleware kan lägga till */
  meta: Record<string, unknown>;
}

/**
 * En middleware-funktion.
 * - `before`: körs innan agenten, kan modifiera ctx eller avbryta
 * - `after`: körs efter agenten, kan modifiera resultat
 * - `onError`: körs om agenten kastar
 */
export interface Middleware {
  name: string;
  /** Prioritet (lägre = körs först). Default: 100. */
  priority?: number;

  before?(info: MiddlewareInfo): Promise<void | 'skip'>;
  after?(info: MiddlewareInfo): Promise<void>;
  onError?(info: MiddlewareInfo): Promise<void>;
}

/**
 * MiddlewarePipeline — kör before/after hooks runt agentexekvering.
 */
export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  /**
   * Registrera en middleware.
   */
  use(mw: Middleware): void {
    this.middlewares.push(mw);
    // Re-sort — lägre prioritet först
    this.middlewares.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  /**
   * Avregistrera en middleware.
   */
  remove(name: string): void {
    this.middlewares = this.middlewares.filter((m) => m.name !== name);
  }

  /**
   * Kör en agent genom hela middleware-pipelinen.
   */
  async execute(agent: BaseAgent, ctx: AgentContext): Promise<AgentResult> {
    const info: MiddlewareInfo = {
      agent,
      ctx,
      startTime: Date.now(),
      meta: {},
    };

    // --- BEFORE-fas ---
    for (const mw of this.middlewares) {
      if (mw.before) {
        const signal = await mw.before(info);
        if (signal === 'skip') {
          // Middleware vill avbryta — returnera tomt resultat
          return { metadata: { skippedBy: mw.name } };
        }
      }
    }

    // --- EXECUTE ---
    try {
      const result = await agent.handle(ctx);
      info.result = result;
      info.endTime = Date.now();

      // --- AFTER-fas ---
      for (const mw of this.middlewares) {
        if (mw.after) {
          await mw.after(info);
        }
      }

      return result;
    } catch (err) {
      info.error = err instanceof Error ? err : new Error(String(err));
      info.endTime = Date.now();

      // --- ERROR-fas ---
      for (const mw of this.middlewares) {
        if (mw.onError) {
          await mw.onError(info);
        }
      }

      throw info.error;
    }
  }
}

// ─────────────────────────────────────────────────────
//  Inbyggda middlewares
// ─────────────────────────────────────────────────────

/**
 * Loggar exekveringstid och agentanvändning.
 */
export function createTimingMiddleware(
  outputChannel: vscode.OutputChannel
): Middleware {
  return {
    name: 'timing',
    priority: 10,
    async before(info) {
      outputChannel.appendLine(
        `[${ts()}] ▶ ${info.agent.name} startar (prompt: "${info.ctx.request.prompt.slice(0, 60)}...")`
      );
    },
    async after(info) {
      const ms = (info.endTime ?? Date.now()) - info.startTime;
      outputChannel.appendLine(
        `[${ts()}] ✅ ${info.agent.name} klart (${ms}ms)`
      );
    },
    async onError(info) {
      const ms = (info.endTime ?? Date.now()) - info.startTime;
      outputChannel.appendLine(
        `[${ts()}] ❌ ${info.agent.name} fel efter ${ms}ms: ${info.error?.message}`
      );
    },
  };
}

/**
 * Räknar agentanvändning och sparar statistik.
 */
export function createUsageMiddleware(
  globalState: vscode.Memento
): Middleware {
  return {
    name: 'usage-tracker',
    priority: 20,
    async after(info) {
      const stats = globalState.get<Record<string, number>>('agentUsageStats') ?? {};
      stats[info.agent.id] = (stats[info.agent.id] ?? 0) + 1;
      await globalState.update('agentUsageStats', stats);
      info.meta['usageCount'] = stats[info.agent.id];
    },
  };
}

/**
 * Guarderar mot för snabba anrop (rate limiting).
 */
export function createRateLimitMiddleware(
  maxPerMinute = 30
): Middleware {
  const timestamps: number[] = [];

  return {
    name: 'rate-limit',
    priority: 1,
    async before(info) {
      const now = Date.now();
      // Rensa gamla (> 60s)
      while (timestamps.length > 0 && now - timestamps[0] > 60_000) {
        timestamps.shift();
      }

      if (timestamps.length >= maxPerMinute) {
        info.ctx.stream.markdown(
          `⚠️ Rate limit nådd (${maxPerMinute}/min). Vänta ett ögonblick.`
        );
        return 'skip';
      }

      timestamps.push(now);
    },
  };
}

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}
