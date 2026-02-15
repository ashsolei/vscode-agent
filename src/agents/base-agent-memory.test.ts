import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AgentMemory } from '../memory/agent-memory';

/**
 * Tests for BaseAgent memory injection (v0.4.0 Feature #1).
 */

class TestAgent extends BaseAgent {
  constructor(id: string = 'test') {
    super(id, 'Test Agent', 'Test agent for memory tests');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    return {};
  }

  // Expose protected memory accessor for testing
  getMemory() {
    return this.memory;
  }
}

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

describe('BaseAgent — memory injection', () => {
  let agent: TestAgent;
  let memory: AgentMemory;
  let memento: any;

  beforeEach(() => {
    agent = new TestAgent('code');
    memento = createMockMemento();
    memory = new AgentMemory(memento);
  });

  it('should have no memory before injection', () => {
    expect(agent.getMemory()).toBeUndefined();
  });

  it('should inject memory via setMemory()', () => {
    agent.setMemory(memory);
    expect(agent.getMemory()).toBe(memory);
  });

  it('should allow agents to use injected memory for remember/recall', () => {
    agent.setMemory(memory);
    const mem = agent.getMemory()!;

    mem.remember('code', 'User prefers functional style');
    const recalled = mem.recall('code');
    expect(recalled).toHaveLength(1);
    expect(recalled[0].content).toBe('User prefers functional style');
  });

  it('should allow buildContextWindow via injected memory', () => {
    agent.setMemory(memory);
    const mem = agent.getMemory()!;

    mem.remember('code', 'Always use arrow functions');
    mem.remember('code', 'Prefer const over let');

    const ctx = mem.buildContextWindow('code');
    expect(ctx).toContain('arrow functions');
    expect(ctx).toContain('const over let');
  });

  it('should allow multiple agents to share the same memory', () => {
    const agent2 = new TestAgent('docs');
    agent.setMemory(memory);
    agent2.setMemory(memory);

    agent.getMemory()!.remember('code', 'TypeScript only');
    agent2.getMemory()!.remember('docs', 'Use JSDoc');

    // Each agent sees all memories (scoped by agentId on recall)
    expect(agent.getMemory()!.recall('code')).toHaveLength(1);
    expect(agent2.getMemory()!.recall('docs')).toHaveLength(1);

    // Total stats reflect both
    const stats = memory.stats();
    expect(stats.totalMemories).toBe(2);
  });

  it('should not break when memory is not injected', () => {
    const mem = agent.getMemory();
    // Accessing memory should return undefined, not throw
    expect(mem).toBeUndefined();
  });
});
