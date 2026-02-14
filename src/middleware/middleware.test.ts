import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MiddlewarePipeline, createRateLimitMiddleware } from './middleware';
import type { Middleware, MiddlewareInfo } from './middleware';
import type { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';

// --- Helpers ---

function makeAgent(id = 'test', handleFn?: (ctx: AgentContext) => Promise<AgentResult>): BaseAgent {
  return {
    id,
    name: `Agent ${id}`,
    description: 'Test agent',
    handle: handleFn ?? (async () => ({ content: 'ok', metadata: {} })),
  } as unknown as BaseAgent;
}

function makeCtx(prompt = 'hello'): AgentContext {
  return {
    request: { prompt, command: undefined },
    chatContext: { history: [] },
    stream: { markdown: vi.fn() },
    token: { isCancellationRequested: false, onCancellationRequested: vi.fn() },
  } as unknown as AgentContext;
}

// --- Tests ---

describe('MiddlewarePipeline', () => {
  let pipeline: MiddlewarePipeline;

  beforeEach(() => {
    pipeline = new MiddlewarePipeline();
  });

  it('executes agent directly when no middleware is registered', async () => {
    const agent = makeAgent('a', async () => ({ content: 'direct', metadata: {} }));
    const result = await pipeline.execute(agent, makeCtx());
    expect(result.content).toBe('direct');
  });

  it('runs before/after hooks in priority order', async () => {
    const order: string[] = [];

    const mwA: Middleware = {
      name: 'A',
      priority: 50,
      async before() { order.push('A-before'); },
      async after() { order.push('A-after'); },
    };

    const mwB: Middleware = {
      name: 'B',
      priority: 10,
      async before() { order.push('B-before'); },
      async after() { order.push('B-after'); },
    };

    pipeline.use(mwA);
    pipeline.use(mwB);

    const agent = makeAgent('x', async () => {
      order.push('agent');
      return { content: 'done', metadata: {} };
    });

    await pipeline.execute(agent, makeCtx());

    expect(order).toEqual(['B-before', 'A-before', 'agent', 'B-after', 'A-after']);
  });

  it('skips execution when before returns "skip"', async () => {
    const skipMw: Middleware = {
      name: 'skipper',
      priority: 1,
      async before() { return 'skip'; },
    };

    pipeline.use(skipMw);

    const handleFn = vi.fn(async () => ({ content: 'never', metadata: {} }));
    const agent = makeAgent('s', handleFn);

    const result = await pipeline.execute(agent, makeCtx());

    expect(handleFn).not.toHaveBeenCalled();
    expect(result.metadata?.skippedBy).toBe('skipper');
  });

  it('calls onError hooks when agent throws', async () => {
    const errorSpy = vi.fn();

    const mw: Middleware = {
      name: 'error-catcher',
      async onError(info: MiddlewareInfo) {
        errorSpy(info.error?.message);
      },
    };

    pipeline.use(mw);

    const agent = makeAgent('e', async () => { throw new Error('boom'); });

    await expect(pipeline.execute(agent, makeCtx())).rejects.toThrow('boom');
    expect(errorSpy).toHaveBeenCalledWith('boom');
  });

  it('removes middleware by name', async () => {
    const order: string[] = [];

    pipeline.use({ name: 'X', async before() { order.push('X'); } });
    pipeline.use({ name: 'Y', async before() { order.push('Y'); } });

    pipeline.remove('X');

    await pipeline.execute(
      makeAgent('r', async () => ({ content: '', metadata: {} })),
      makeCtx()
    );

    expect(order).toEqual(['Y']);
  });

  it('passes meta between before and after hooks', async () => {
    let capturedMeta: Record<string, unknown> = {};

    pipeline.use({
      name: 'meta-writer',
      priority: 1,
      async before(info) { info.meta['tag'] = 'hello'; },
    });

    pipeline.use({
      name: 'meta-reader',
      priority: 2,
      async after(info) { capturedMeta = { ...info.meta }; },
    });

    await pipeline.execute(
      makeAgent('m', async () => ({ content: '', metadata: {} })),
      makeCtx()
    );

    expect(capturedMeta['tag']).toBe('hello');
  });
});

describe('createRateLimitMiddleware', () => {
  let pipeline: MiddlewarePipeline;

  beforeEach(() => {
    pipeline = new MiddlewarePipeline();
    vi.useRealTimers();
  });

  it('tillåter anrop under gränsen', async () => {
    const mw = createRateLimitMiddleware(5);
    pipeline.use(mw);

    const agent = makeAgent('a', async () => ({ content: 'ok', metadata: {} }));

    for (let i = 0; i < 3; i++) {
      const result = await pipeline.execute(agent, makeCtx());
      expect(result.content).toBe('ok');
      expect(result.metadata?.skippedBy).toBeUndefined();
    }
  });

  it('blockerar anrop över gränsen', async () => {
    const mw = createRateLimitMiddleware(2);
    pipeline.use(mw);

    const agent = makeAgent('a', async () => ({ content: 'ok', metadata: {} }));

    const r1 = await pipeline.execute(agent, makeCtx());
    expect(r1.metadata?.skippedBy).toBeUndefined();

    const r2 = await pipeline.execute(agent, makeCtx());
    expect(r2.metadata?.skippedBy).toBeUndefined();

    const ctx3 = makeCtx();
    const r3 = await pipeline.execute(agent, ctx3);
    expect(r3.metadata?.skippedBy).toBe('rate-limit');
    expect(ctx3.stream.markdown).toHaveBeenCalled();
  });

  it('återställer efter timeout', async () => {
    vi.useFakeTimers();

    const mw = createRateLimitMiddleware(1);
    pipeline.use(mw);

    const agent = makeAgent('a', async () => ({ content: 'ok', metadata: {} }));

    const r1 = await pipeline.execute(agent, makeCtx());
    expect(r1.metadata?.skippedBy).toBeUndefined();

    vi.advanceTimersByTime(61_000);

    const r2 = await pipeline.execute(agent, makeCtx());
    expect(r2.content).toBe('ok');
    expect(r2.metadata?.skippedBy).toBeUndefined();

    vi.useRealTimers();
  });
});
