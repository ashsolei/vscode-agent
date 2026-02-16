import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vsc from 'vscode';
import { AgentRetryHandler, AgentRetryError } from './retry-handler';
import { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';

// ─── Test helpers ─────────────────────────────

class SuccessAgent extends BaseAgent {
  constructor() { super('success', 'Success Agent', 'Always succeeds'); }
  async handle(_ctx: AgentContext): Promise<AgentResult> {
    return { metadata: { ok: true } };
  }
}

class FailAgent extends BaseAgent {
  callCount = 0;
  constructor(public errorMsg = 'Test failure') {
    super('fail', 'Fail Agent', 'Always fails');
  }
  async handle(_ctx: AgentContext): Promise<AgentResult> {
    this.callCount++;
    throw new Error(this.errorMsg);
  }
}

class FlakeyAgent extends BaseAgent {
  callCount = 0;
  constructor(public failUntil = 2) {
    super('flakey', 'Flakey Agent', 'Fails then succeeds');
  }
  async handle(_ctx: AgentContext): Promise<AgentResult> {
    this.callCount++;
    if (this.callCount < this.failUntil) {
      throw new Error(`Fail #${this.callCount}`);
    }
    return { metadata: { attempt: this.callCount } };
  }
}

class SlowAgent extends BaseAgent {
  constructor(public delayMs = 2000) {
    super('slow', 'Slow Agent', 'Takes a long time');
  }
  async handle(_ctx: AgentContext): Promise<AgentResult> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return { metadata: { slow: true } };
  }
}

function createMockCtx(): AgentContext {
  return {
    request: {
      prompt: 'test prompt',
      command: 'test',
      model: {} as any,
    } as any,
    chatContext: { history: [] } as any,
    stream: {
      markdown: vi.fn(),
      progress: vi.fn(),
      reference: vi.fn(),
      button: vi.fn(),
      anchor: vi.fn(),
    } as any,
    token: { isCancellationRequested: false, onCancellationRequested: vi.fn() } as any,
  };
}

// ─── Tests ────────────────────────────────────

describe('AgentRetryHandler', () => {
  let handler: AgentRetryHandler;

  beforeEach(() => {
    handler = new AgentRetryHandler({
      maxRetries: 2,
      initialDelayMs: 10,
      backoffMultiplier: 2,
      maxDelayMs: 100,
    });
  });

  describe('constructor & config', () => {
    it('skapar med standardkonfiguration', () => {
      const h = new AgentRetryHandler();
      expect(h.currentConfig.maxRetries).toBe(2);
      expect(h.currentConfig.initialDelayMs).toBe(500);
      expect(h.currentConfig.backoffMultiplier).toBe(2);
      expect(h.currentConfig.maxDelayMs).toBe(5000);
      expect(h.currentConfig.timeoutMs).toBe(0);
      expect(h.currentConfig.retryableErrors).toEqual([]);
      h.dispose();
    });

    it('skapar med anpassad konfiguration', () => {
      expect(handler.currentConfig.maxRetries).toBe(2);
      expect(handler.currentConfig.initialDelayMs).toBe(10);
    });

    it('uppdaterar konfiguration', () => {
      handler.updateConfig({ maxRetries: 5 });
      expect(handler.currentConfig.maxRetries).toBe(5);
      expect(handler.currentConfig.initialDelayMs).toBe(10); // oförändrad
    });
  });

  describe('fallback-konfiguration', () => {
    it('sätter och hämtar fallbacks', () => {
      handler.setFallback('code', ['docs', 'explain']);
      expect(handler.getFallbacks('code')).toEqual(['docs', 'explain']);
    });

    it('returnerar tom lista för okända agenter', () => {
      expect(handler.getFallbacks('unknown')).toEqual([]);
    });

    it('tar bort fallback', () => {
      handler.setFallback('code', ['docs']);
      handler.removeFallback('code');
      expect(handler.getFallbacks('code')).toEqual([]);
    });

    it('uppdaterar fallbacks med map', () => {
      const map = new Map([['a', ['b', 'c']]]);
      handler.updateFallbacks(map);
      expect(handler.getFallbacks('a')).toEqual(['b', 'c']);
    });

    it('exponerar currentFallbacks', () => {
      handler.setFallback('x', ['y']);
      expect(handler.currentFallbacks.get('x')).toEqual(['y']);
    });
  });

  describe('executeWithRetry', () => {
    it('lyckas direkt utan retries', async () => {
      const agent = new SuccessAgent();
      const ctx = createMockCtx();
      const { result, attempts } = await handler.executeWithRetry(agent, ctx);
      expect(result.metadata).toEqual({ ok: true });
      expect(attempts).toHaveLength(1);
      expect(attempts[0].success).toBe(true);
      expect(attempts[0].attempt).toBe(1);
      expect(attempts[0].usedFallback).toBe(false);
    });

    it('retry:ar vid misslyckande och lyckas', async () => {
      const agent = new FlakeyAgent(2); // Misslyckas 1 gång, lyckas 2:a
      const ctx = createMockCtx();
      const { result, attempts } = await handler.executeWithRetry(agent, ctx);
      expect(result.metadata).toEqual({ attempt: 2 });
      expect(attempts).toHaveLength(2);
      expect(attempts[0].success).toBe(false);
      expect(attempts[1].success).toBe(true);
    });

    it('kastar AgentRetryError efter alla försök misslyckas', async () => {
      const agent = new FailAgent('kaputt');
      const ctx = createMockCtx();
      await expect(handler.executeWithRetry(agent, ctx))
        .rejects.toThrow(AgentRetryError);

      try {
        await handler.executeWithRetry(agent, ctx);
      } catch (err) {
        expect(err).toBeInstanceOf(AgentRetryError);
        const retryErr = err as AgentRetryError;
        // 3 attempts total per call (1 initial + 2 retries)
        expect(retryErr.attempts.length).toBe(3);
        expect(retryErr.attempts.every((a) => !a.success)).toBe(true);
      }
    });

    it('använder fallback-agent vid primärt misslyckande', async () => {
      const failAgent = new FailAgent();
      const successAgent = new SuccessAgent();
      handler.setFallback('fail', ['success']);

      const ctx = createMockCtx();
      const agents = new Map<string, BaseAgent>([
        ['fail', failAgent],
        ['success', successAgent],
      ]);

      const { result, attempts } = await handler.executeWithRetry(
        failAgent,
        ctx,
        (id) => agents.get(id)
      );

      expect(result.metadata).toEqual({ ok: true });
      // 3 failed + 1 success via fallback
      const failedAttempts = attempts.filter((a) => !a.success);
      const successAttempts = attempts.filter((a) => a.success);
      expect(failedAttempts.length).toBeGreaterThanOrEqual(3);
      expect(successAttempts.length).toBe(1);
      expect(successAttempts[0].usedFallback).toBe(true);
    });

    it('hoppar okänd fallback-agent', async () => {
      const failAgent = new FailAgent();
      handler.setFallback('fail', ['nonexistent']);

      const ctx = createMockCtx();
      await expect(handler.executeWithRetry(
        failAgent,
        ctx,
        () => undefined
      )).rejects.toThrow(AgentRetryError);
    });

    it('visar progress vid retry', async () => {
      const agent = new FlakeyAgent(2);
      const ctx = createMockCtx();
      await handler.executeWithRetry(agent, ctx);
      expect(ctx.stream.progress).toHaveBeenCalled();
    });

    it('visar progress vid fallback (notifyOnFallback)', async () => {
      const failAgent = new FailAgent();
      const successAgent = new SuccessAgent();
      handler.setFallback('fail', ['success']);

      const ctx = createMockCtx();
      const agents = new Map<string, BaseAgent>([
        ['fail', failAgent],
        ['success', successAgent],
      ]);

      await handler.executeWithRetry(failAgent, ctx, (id) => agents.get(id));

      const progressCalls = (ctx.stream.progress as ReturnType<typeof vi.fn>).mock.calls;
      const fallbackMsg = progressCalls.some(
        (call: any[]) => String(call[0]).includes('fallback')
      );
      expect(fallbackMsg).toBe(true);
    });

    it('respekterar retryableErrors filter', async () => {
      handler.updateConfig({ retryableErrors: ['timeout'] });
      const agent = new FailAgent('connection refused');
      const ctx = createMockCtx();

      try {
        await handler.executeWithRetry(agent, ctx);
      } catch (err) {
        const retryErr = err as AgentRetryError;
        // Ska bara ha 1 attempt — felet matchar inte retryableErrors
        expect(retryErr.attempts.length).toBe(1);
      }
    });

    it('retry:ar vid matchande retryableErrors', async () => {
      handler.updateConfig({ retryableErrors: ['timeout'] });
      const agent = new FailAgent('Request timeout');
      const ctx = createMockCtx();

      try {
        await handler.executeWithRetry(agent, ctx);
      } catch (err) {
        const retryErr = err as AgentRetryError;
        // Ska ha 3 attempts — felet matchar retryableErrors
        expect(retryErr.attempts.length).toBe(3);
      }
    });

    it('stoppar vid cancellation', async () => {
      const agent = new FlakeyAgent(5);
      const ctx = createMockCtx();
      // Simulera cancellation efter start
      (ctx.token as any).isCancellationRequested = true;

      await expect(handler.executeWithRetry(agent, ctx))
        .rejects.toThrow(AgentRetryError);
    });
  });

  describe('timeout', () => {
    it('kastar timeout-fel om agenten tar för lång tid', async () => {
      handler.updateConfig({ timeoutMs: 50 });
      const agent = new SlowAgent(500);
      const ctx = createMockCtx();

      await expect(handler.executeWithRetry(agent, ctx))
        .rejects.toThrow(/Timeout/i);
    });
  });

  describe('statistik', () => {
    it('spårar historik', async () => {
      const agent = new SuccessAgent();
      const ctx = createMockCtx();
      await handler.executeWithRetry(agent, ctx);
      await handler.executeWithRetry(agent, ctx);

      const history = handler.getHistory();
      expect(history).toHaveLength(2);
      expect(history.every((a) => a.success)).toBe(true);
    });

    it('beräknar stats korrekt', async () => {
      const successAgent = new SuccessAgent();
      const ctx = createMockCtx();
      await handler.executeWithRetry(successAgent, ctx);

      const stats = handler.stats();
      expect(stats.totalAttempts).toBeGreaterThanOrEqual(1);
      expect(stats.successRate).toBe(1);
      expect(stats.byAgent['success']).toBeDefined();
    });

    it('stats med retries räknar korrekt', async () => {
      const agent = new FlakeyAgent(2);
      const ctx = createMockCtx();
      await handler.executeWithRetry(agent, ctx);

      const stats = handler.stats();
      expect(stats.byAgent['flakey'].total).toBe(2);
      expect(stats.byAgent['flakey'].successes).toBe(1);
      expect(stats.byAgent['flakey'].failures).toBe(1);
      expect(stats.byAgent['flakey'].retries).toBe(1); // 2nd attempt counts as retry
    });

    it('rensar historik', () => {
      handler.clearHistory();
      expect(handler.getHistory()).toHaveLength(0);
    });

    it('begränsar historik med limit', async () => {
      const agent = new SuccessAgent();
      const ctx = createMockCtx();
      await handler.executeWithRetry(agent, ctx);
      await handler.executeWithRetry(agent, ctx);
      await handler.executeWithRetry(agent, ctx);

      expect(handler.getHistory(2)).toHaveLength(2);
    });

    it('trimmar historik vid MAX_HISTORY', async () => {
      const agent = new SuccessAgent();
      const ctx = createMockCtx();

      // Kör mer än MAX_HISTORY
      for (let i = 0; i < 5; i++) {
        await handler.executeWithRetry(agent, ctx);
      }

      expect(handler.getHistory().length).toBeLessThanOrEqual(AgentRetryHandler.MAX_HISTORY);
    });
  });

  describe('onDidRetry event', () => {
    it('emittar vid varje försök', async () => {
      const events: any[] = [];
      handler.onDidRetry((e) => events.push(e));

      const agent = new FlakeyAgent(2);
      const ctx = createMockCtx();
      await handler.executeWithRetry(agent, ctx);

      expect(events).toHaveLength(2);
      expect(events[0].success).toBe(false);
      expect(events[1].success).toBe(true);
    });
  });

  describe('createMiddleware', () => {
    it('skapar middleware med korrekt namn och prioritet', () => {
      const mw = handler.createMiddleware();
      expect(mw.name).toBe('retry-fallback');
      expect(mw.priority).toBe(200);
      expect(mw.onError).toBeDefined();
    });
  });

  describe('dispose', () => {
    it('kan disponeras utan fel', () => {
      expect(() => handler.dispose()).not.toThrow();
    });
  });
});
