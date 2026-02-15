import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from './index';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

/**
 * Tests for profile-based routing and telemetry-enhanced smartRoute.
 */

class TestAgent extends BaseAgent {
  handleFn: ReturnType<typeof vi.fn>;

  constructor(id: string, name: string = id) {
    super(id, name, `Test agent: ${name}`);
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

describe('AgentRegistry — profile-based resolve', () => {
  let registry: AgentRegistry;
  let codeAgent: TestAgent;
  let docsAgent: TestAgent;
  let securityAgent: TestAgent;

  beforeEach(() => {
    registry = new AgentRegistry();
    codeAgent = new TestAgent('code', 'Code Agent');
    docsAgent = new TestAgent('docs', 'Docs Agent');
    securityAgent = new TestAgent('security', 'Security Agent');
    registry.register(codeAgent);
    registry.register(docsAgent);
    registry.register(securityAgent);
    registry.setDefault('code');
  });

  it('should resolve by command regardless of profile', () => {
    const ctx = makeCtx('docs');
    // Even with a profile that doesn't include docs, a slash command should work
    expect(registry.resolve(ctx, ['code', 'security'])).toBe(docsAgent);
  });

  it('should use first profile agent when no command and profile is set', () => {
    const ctx = makeCtx(undefined);
    const resolved = registry.resolve(ctx, ['security', 'docs']);
    expect(resolved).toBe(securityAgent);
  });

  it('should fall back to default when no command and no profile', () => {
    const ctx = makeCtx(undefined);
    const resolved = registry.resolve(ctx);
    expect(resolved).toBe(codeAgent);
  });

  it('should fall back to default when profile agents list is empty', () => {
    const ctx = makeCtx(undefined);
    const resolved = registry.resolve(ctx, []);
    expect(resolved).toBe(codeAgent);
  });

  it('should skip non-existent profile agents', () => {
    const ctx = makeCtx(undefined);
    const resolved = registry.resolve(ctx, ['nonexistent', 'docs']);
    expect(resolved).toBe(docsAgent);
  });

  it('should fall back to default if all profile agents are non-existent', () => {
    const ctx = makeCtx(undefined);
    const resolved = registry.resolve(ctx, ['foo', 'bar']);
    expect(resolved).toBe(codeAgent);
  });
});

describe('AgentRegistry — smartRoute with options', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(new TestAgent('code', 'Code Agent'));
    registry.register(new TestAgent('docs', 'Docs Agent'));
    registry.register(new TestAgent('security', 'Security Agent'));
    registry.setDefault('code');
  });

  it('should fall back to default when LLM is unavailable', async () => {
    const ctx = makeCtx(undefined, 'write a function');
    // model.sendRequest will throw (no real LLM)
    const result = await registry.smartRoute(ctx);
    expect(result?.id).toBe('code');
  });

  it('should fall back to default when smartRoute options are empty', async () => {
    const ctx = makeCtx(undefined, 'test');
    const result = await registry.smartRoute(ctx, {});
    expect(result?.id).toBe('code');
  });

  it('should fall back to default with profile filter but no LLM', async () => {
    const ctx = makeCtx(undefined, 'check security');
    const result = await registry.smartRoute(ctx, {
      profileAgents: ['security', 'code'],
    });
    // Without LLM, falls back to default
    expect(result?.id).toBe('code');
  });

  it('should fall back to default with telemetry stats but no LLM', async () => {
    const ctx = makeCtx(undefined, 'review code');
    const result = await registry.smartRoute(ctx, {
      telemetryStats: {
        code: { successRate: 95, avgDurationMs: 200 },
        docs: { successRate: 80, avgDurationMs: 300 },
      },
    });
    expect(result?.id).toBe('code');
  });

  it('should return default when profile has no matching agents', async () => {
    const ctx = makeCtx(undefined, 'test');
    const result = await registry.smartRoute(ctx, {
      profileAgents: ['nonexistent'],
    });
    expect(result?.id).toBe('code');
  });
});
