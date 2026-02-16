import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MiddlewarePipeline,
  createTimingMiddleware,
  createUsageMiddleware,
  createRateLimitMiddleware,
} from './middleware';
import type { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';

// --- Helpers ---

function makeAgent(id = 'test', handleFn?: (ctx: AgentContext) => Promise<AgentResult>): BaseAgent {
  return {
    id,
    name: `Agent ${id}`,
    description: 'Test agent',
    isAutonomous: false,
    handle: handleFn ?? (async () => ({ metadata: {} })),
  } as unknown as BaseAgent;
}

function makeCtx(prompt = 'hello'): AgentContext {
  return {
    request: { prompt, command: 'test' },
    chatContext: { history: [] },
    stream: { markdown: vi.fn(), progress: vi.fn() },
    token: { isCancellationRequested: false, onCancellationRequested: vi.fn() },
  } as unknown as AgentContext;
}

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: (key: string, defaultValue?: any) => store[key] ?? defaultValue,
    update: async (key: string, value: any) => { store[key] = value; },
  };
}

// --- Built-in middleware tests ---

describe('createTimingMiddleware', () => {
  it('should log start and completion', async () => {
    const appendLine = vi.fn();
    const channel = { appendLine } as any;

    const mw = createTimingMiddleware(channel);
    const pipeline = new MiddlewarePipeline();
    pipeline.use(mw);

    await pipeline.execute(
      makeAgent('timer', async () => ({ metadata: {} })),
      makeCtx('test prompt')
    );

    expect(appendLine).toHaveBeenCalledTimes(2);
    const startCall = appendLine.mock.calls[0][0] as string;
    const endCall = appendLine.mock.calls[1][0] as string;
    expect(startCall).toContain('▶');
    expect(startCall).toContain('Agent timer');
    expect(endCall).toContain('✅');
    expect(endCall).toMatch(/\d+ms/);
  });

  it('should log errors', async () => {
    const appendLine = vi.fn();
    const channel = { appendLine } as any;

    const mw = createTimingMiddleware(channel);
    const pipeline = new MiddlewarePipeline();
    pipeline.use(mw);

    await expect(
      pipeline.execute(
        makeAgent('err', async () => { throw new Error('fail'); }),
        makeCtx()
      )
    ).rejects.toThrow('fail');

    const errorCall = appendLine.mock.calls.find((c: any) => c[0].includes('❌'));
    expect(errorCall).toBeTruthy();
    expect(errorCall![0]).toContain('fail');
  });
});

describe('createUsageMiddleware', () => {
  it('should track agent usage counts', async () => {
    const memento = createMockMemento();
    const mw = createUsageMiddleware(memento);
    const pipeline = new MiddlewarePipeline();
    pipeline.use(mw);

    const agent = makeAgent('counter', async () => ({ metadata: {} }));

    await pipeline.execute(agent, makeCtx());
    await pipeline.execute(agent, makeCtx());
    await pipeline.execute(agent, makeCtx());

    const stats = memento.get('agentUsageStats');
    expect(stats.counter).toBe(3);
  });

  it('should track multiple agents separately', async () => {
    const memento = createMockMemento();
    const mw = createUsageMiddleware(memento);
    const pipeline = new MiddlewarePipeline();
    pipeline.use(mw);

    await pipeline.execute(makeAgent('a', async () => ({ metadata: {} })), makeCtx());
    await pipeline.execute(makeAgent('b', async () => ({ metadata: {} })), makeCtx());
    await pipeline.execute(makeAgent('a', async () => ({ metadata: {} })), makeCtx());

    const stats = memento.get('agentUsageStats');
    expect(stats.a).toBe(2);
    expect(stats.b).toBe(1);
  });
});

describe('createRateLimitMiddleware', () => {
  it('should allow requests within limit', async () => {
    const mw = createRateLimitMiddleware(5);
    const pipeline = new MiddlewarePipeline();
    pipeline.use(mw);

    const agent = makeAgent('rl', async () => ({ metadata: { ok: true } }));

    for (let i = 0; i < 5; i++) {
      const result = await pipeline.execute(agent, makeCtx());
      expect(result.metadata?.skippedBy).toBeUndefined();
    }
  });

  it('should skip when rate limit is exceeded', async () => {
    const mw = createRateLimitMiddleware(2);
    const pipeline = new MiddlewarePipeline();
    pipeline.use(mw);

    const agent = makeAgent('rl', async () => ({ metadata: {} }));

    await pipeline.execute(agent, makeCtx());
    await pipeline.execute(agent, makeCtx());
    // Third call should be rate limited
    const result = await pipeline.execute(agent, makeCtx());
    expect(result.metadata?.skippedBy).toBe('rate-limit');
  });
});

// --- Error isolation tests ---

describe('MiddlewarePipeline error isolation', () => {
  it('should isolate after-hook errors from breaking pipeline', async () => {
    const pipeline = new MiddlewarePipeline();
    const afterOrder: string[] = [];

    pipeline.use({
      name: 'first',
      priority: 1,
      async after() {
        afterOrder.push('first');
        throw new Error('after hook exploded');
      },
    });

    pipeline.use({
      name: 'second',
      priority: 2,
      async after() {
        afterOrder.push('second');
      },
    });

    const result = await pipeline.execute(
      makeAgent('x', async () => ({ metadata: { val: 1 } })),
      makeCtx()
    );

    // Both after hooks should have run
    expect(afterOrder).toEqual(['first', 'second']);
    // Agent result should still be returned
    expect(result.metadata?.val).toBe(1);
  });

  it('should isolate onError-hook errors so original error propagates', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use({
      name: 'bad-error-handler',
      async onError() {
        throw new Error('onError itself broke');
      },
    });

    await expect(
      pipeline.execute(
        makeAgent('e', async () => { throw new Error('original'); }),
        makeCtx()
      )
    ).rejects.toThrow('original');
  });
});

describe('MiddlewarePipeline.clear()', () => {
  it('should remove all middlewares', async () => {
    const pipeline = new MiddlewarePipeline();
    const beforeFn = vi.fn();
    pipeline.use({ name: 'mw1', before: beforeFn });
    pipeline.use({ name: 'mw2', before: beforeFn });

    pipeline.clear();

    await pipeline.execute(makeAgent(), makeCtx());
    expect(beforeFn).not.toHaveBeenCalled();
  });

  it('should allow re-adding middlewares after clear', async () => {
    const pipeline = new MiddlewarePipeline();
    const oldBefore = vi.fn();
    const newBefore = vi.fn();
    pipeline.use({ name: 'old', before: oldBefore });

    pipeline.clear();
    pipeline.use({ name: 'new', before: newBefore });

    await pipeline.execute(makeAgent(), makeCtx());
    expect(oldBefore).not.toHaveBeenCalled();
    expect(newBefore).toHaveBeenCalled();
  });
});
