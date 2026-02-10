import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from '../agents/index';
import { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';

// Minimal concrete agent for testing
class TestAgent extends BaseAgent {
  handleFn = vi.fn<[AgentContext], Promise<AgentResult>>();

  constructor(id: string, name: string = id) {
    super(id, name, `Test agent: ${id}`);
    this.handleFn.mockResolvedValue({});
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    return this.handleFn(ctx);
  }
}

function makeCtx(command?: string, prompt: string = 'test'): AgentContext {
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

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let codeAgent: TestAgent;
  let docsAgent: TestAgent;

  beforeEach(() => {
    registry = new AgentRegistry();
    codeAgent = new TestAgent('code', 'Code Agent');
    docsAgent = new TestAgent('docs', 'Docs Agent');
    registry.register(codeAgent);
    registry.register(docsAgent);
  });

  it('should register agents', () => {
    expect(registry.list()).toHaveLength(2);
  });

  it('should get agent by id', () => {
    expect(registry.get('code')).toBe(codeAgent);
    expect(registry.get('docs')).toBe(docsAgent);
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should resolve agent by command', () => {
    const ctx = makeCtx('docs');
    expect(registry.resolve(ctx)).toBe(docsAgent);
  });

  it('should resolve default agent when no command', () => {
    registry.setDefault('code');
    const ctx = makeCtx(undefined);
    expect(registry.resolve(ctx)).toBe(codeAgent);
  });

  it('should fall back to default for unknown command', () => {
    registry.setDefault('code');
    const ctx = makeCtx('nonexistent');
    expect(registry.resolve(ctx)).toBe(codeAgent);
  });

  it('should set default agent', () => {
    registry.setDefault('docs');
    const ctx = makeCtx(undefined);
    expect(registry.resolve(ctx)).toBe(docsAgent);
  });

  it('should list all agents', () => {
    const agents = registry.list();
    expect(agents.map((a) => a.id)).toEqual(['code', 'docs']);
  });

  it('should delegate to another agent', async () => {
    registry.setDefault('code');
    codeAgent.setRegistry(registry);
    docsAgent.setRegistry(registry);

    const ctx = makeCtx('code', 'delegated prompt');
    const { result } = await registry.delegate('docs', ctx, 'override prompt');
    expect(docsAgent.handleFn).toHaveBeenCalledTimes(1);
  });
});
