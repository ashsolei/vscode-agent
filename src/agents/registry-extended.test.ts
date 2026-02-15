import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from './index';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

/**
 * Extended registry tests — covers unregister, parallel, chain, edge cases.
 */

class TestAgent extends BaseAgent {
  handleFn: ReturnType<typeof vi.fn>;

  constructor(id: string, name: string = id, opts?: { isAutonomous?: boolean }) {
    super(id, name, `Test agent: ${name}`, opts);
    this.handleFn = vi.fn().mockResolvedValue({});
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    return this.handleFn(ctx);
  }
}

function makeCtx(command?: string, prompt = 'test'): AgentContext {
  return {
    request: { command, prompt, model: {} } as any,
    chatContext: { history: [] } as any,
    stream: {
      markdown: vi.fn(),
      progress: vi.fn(),
      button: vi.fn(),
      reference: vi.fn(),
    } as any,
    token: { isCancellationRequested: false } as any,
  };
}

describe('AgentRegistry — unregister', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('should unregister an existing agent', () => {
    const agent = new TestAgent('code', 'Code');
    registry.register(agent);

    expect(registry.unregister('code')).toBe(true);
    expect(registry.get('code')).toBeUndefined();
    expect(registry.list()).toHaveLength(0);
  });

  it('should return false for non-existent agent', () => {
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('should reassign default when default agent is unregistered', () => {
    const a = new TestAgent('a', 'A');
    const b = new TestAgent('b', 'B');
    registry.register(a);
    registry.register(b);
    registry.setDefault('a');

    registry.unregister('a');

    const ctx = makeCtx(undefined);
    const resolved = registry.resolve(ctx);
    expect(resolved).toBe(b);
  });

  it('should handle unregistering the only agent', () => {
    const agent = new TestAgent('solo');
    registry.register(agent);
    registry.unregister('solo');

    const ctx = makeCtx(undefined);
    expect(registry.resolve(ctx)).toBeUndefined();
  });
});

describe('AgentRegistry — duplicate registration', () => {
  it('should overwrite agent with same id', () => {
    const registry = new AgentRegistry();
    const v1 = new TestAgent('code', 'Code V1');
    const v2 = new TestAgent('code', 'Code V2');

    registry.register(v1);
    registry.register(v2);

    expect(registry.get('code')).toBe(v2);
    expect(registry.list()).toHaveLength(1);
  });
});

describe('AgentRegistry — parallel execution', () => {
  it('should run multiple agents in parallel', async () => {
    const registry = new AgentRegistry();
    const a = new TestAgent('a', 'A');
    const b = new TestAgent('b', 'B');
    a.handleFn.mockResolvedValue({ metadata: { agent: 'a' } });
    b.handleFn.mockResolvedValue({ metadata: { agent: 'b' } });

    registry.register(a);
    registry.register(b);

    const ctx = makeCtx(undefined, 'parallel test');
    const results = await registry.parallel(
      [{ agentId: 'a' }, { agentId: 'b' }],
      ctx
    );

    expect(results).toHaveLength(2);
    expect(results[0].agentId).toBe('a');
    expect(results[1].agentId).toBe('b');
    expect(results[0].error).toBeUndefined();
    expect(results[1].error).toBeUndefined();
  });

  it('should handle errors in parallel agents gracefully', async () => {
    const registry = new AgentRegistry();
    const ok = new TestAgent('ok', 'OK');
    ok.handleFn.mockResolvedValue({ metadata: {} });
    const bad = new TestAgent('bad', 'Bad');
    bad.handleFn.mockRejectedValue(new Error('exploded'));

    registry.register(ok);
    registry.register(bad);

    const results = await registry.parallel(
      [{ agentId: 'ok' }, { agentId: 'bad' }],
      makeCtx()
    );

    expect(results.find(r => r.agentId === 'ok')?.error).toBeUndefined();
    expect(results.find(r => r.agentId === 'bad')?.error).toContain('exploded');
  });

  it('should handle non-existent agent in parallel', async () => {
    const registry = new AgentRegistry();
    const results = await registry.parallel(
      [{ agentId: 'ghost' }],
      makeCtx()
    );

    expect(results[0].error).toContain('ghost');
  });
});

describe('AgentRegistry — chain execution', () => {
  it('should chain agents in sequence', async () => {
    const registry = new AgentRegistry();
    const order: string[] = [];

    const a = new TestAgent('a', 'A');
    a.handleFn.mockImplementation(async (ctx: AgentContext) => {
      order.push('a');
      ctx.stream.markdown('output-a');
      return {};
    });

    const b = new TestAgent('b', 'B');
    b.handleFn.mockImplementation(async (ctx: AgentContext) => {
      order.push('b');
      ctx.stream.markdown('output-b');
      return {};
    });

    registry.register(a);
    registry.register(b);

    const results = await registry.chain(
      [
        { agentId: 'a', prompt: 'step 1' },
        { agentId: 'b', prompt: 'step 2', pipeOutput: true },
      ],
      makeCtx()
    );

    expect(order).toEqual(['a', 'b']);
    expect(results).toHaveLength(2);
  });
});

describe('AgentRegistry — delegate with invalid agent', () => {
  it('should throw for non-existent delegate target', async () => {
    const registry = new AgentRegistry();
    await expect(
      registry.delegate('nonexistent', makeCtx())
    ).rejects.toThrow('nonexistent');
  });
});

describe('BaseAgent — isAutonomous flag', () => {
  it('should default to false', () => {
    const agent = new TestAgent('basic', 'Basic');
    expect(agent.isAutonomous).toBe(false);
  });

  it('should be true when set', () => {
    const agent = new TestAgent('auto', 'Auto', { isAutonomous: true });
    expect(agent.isAutonomous).toBe(true);
  });
});
