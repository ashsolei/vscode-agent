import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentMemory } from '../memory/agent-memory';

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

describe('AgentMemory', () => {
  let memory: AgentMemory;
  let memento: any;

  beforeEach(() => {
    memento = createMockMemento();
    memory = new AgentMemory(memento);
  });

  it('should remember a fact', () => {
    const mem = memory.remember('code', 'User prefers TypeScript');
    expect(mem.id).toBeDefined();
    expect(mem.agentId).toBe('code');
    expect(mem.content).toBe('User prefers TypeScript');
    expect(mem.type).toBe('fact');
  });

  it('should remember with tags', () => {
    const mem = memory.remember('code', 'Use strict mode', {
      type: 'preference',
      tags: ['typescript', 'config'],
    });
    expect(mem.type).toBe('preference');
    expect(mem.tags).toEqual(['typescript', 'config']);
  });

  it('should recall memories for an agent', () => {
    memory.remember('code', 'fact1');
    memory.remember('docs', 'fact2');
    memory.remember('code', 'fact3');

    const recalled = memory.recall('code');
    expect(recalled).toHaveLength(2);
    expect(recalled.map((m) => m.content)).toEqual(['fact1', 'fact3']);
  });

  it('should forget a specific memory', () => {
    const m1 = memory.remember('code', 'to-forget');
    memory.remember('code', 'to-keep');

    const forgotten = memory.forget(m1.id);
    expect(forgotten).toBe(true);
    expect(memory.recall('code')).toHaveLength(1);
  });

  it('should return false when forgetting non-existent', () => {
    expect(memory.forget('nonexistent')).toBe(false);
  });

  it('should forget all memories for an agent', () => {
    memory.remember('code', 'a');
    memory.remember('code', 'b');
    memory.remember('docs', 'c');

    const count = memory.forgetAll('code');
    expect(count).toBe(2);
    expect(memory.recall('code')).toHaveLength(0);
    expect(memory.recall('docs')).toHaveLength(1);
  });

  it('should search by keyword', () => {
    memory.remember('code', 'TypeScript strict mode');
    memory.remember('code', 'React hooks best practices');
    memory.remember('code', 'Python flask tutorial');

    const results = memory.search('TypeScript');
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('TypeScript');
  });

  it('should search by multiple words', () => {
    memory.remember('code', 'TypeScript strict mode');
    memory.remember('code', 'React hooks with TypeScript');

    const results = memory.search('TypeScript hooks');
    expect(results).toHaveLength(2);
    // Most relevant first (2 matches)
    expect(results[0].content).toContain('hooks');
    expect(results[0].content).toContain('TypeScript');
  });

  it('should find by tags', () => {
    memory.remember('code', 'ts config', { tags: ['typescript'] });
    memory.remember('code', 'py config', { tags: ['python'] });

    const found = memory.findByTags(['typescript']);
    expect(found).toHaveLength(1);
    expect(found[0].content).toBe('ts config');
  });

  it('should build context window', () => {
    memory.remember('code', 'User prefers Vitest over Jest');
    memory.remember('code', 'Always use arrow functions');

    const ctx = memory.buildContextWindow('code');
    expect(ctx).toContain('User prefers Vitest');
    expect(ctx).toContain('arrow functions');
  });

  it('should provide stats', () => {
    memory.remember('code', 'a');
    memory.remember('docs', 'b');
    memory.remember('code', 'c');

    const stats = memory.stats();
    expect(stats.totalMemories).toBe(3);
    expect(stats.byAgent).toHaveProperty('code');
    expect(stats.byAgent).toHaveProperty('docs');
  });

  it('should persist via memento', () => {
    memory.remember('code', 'persisted');
    expect(memento.update).toHaveBeenCalled();
  });

  it('should increment access count on recall', () => {
    const m = memory.remember('code', 'count-test');
    expect(m.accessCount).toBe(0);

    const recalled = memory.recall('code');
    expect(recalled[0].accessCount).toBe(1);
  });

  // ─── v0.10.0: dispose + async persist ────────

  it('should have a dispose method', () => {
    expect(typeof memory.dispose).toBe('function');
    expect(() => memory.dispose()).not.toThrow();
  });

  it('dispose should do final save if dirty', () => {
    vi.useFakeTimers();
    memory.remember('code', 'dirty-data');
    // debouncedPersist sets a timer, so persist hasn't run yet in fake timers
    // dispose should save immediately
    memory.dispose();
    // memento.update should have been called (from remember's debouncedPersist + dispose)
    expect(memento.update).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('dispose should clear persist timer', () => {
    vi.useFakeTimers();
    memory.remember('code', 'timer-test');
    memory.dispose();
    // Advance timers — the debounced persist should not fire again
    const callCountBefore = memento.update.mock.calls.length;
    vi.advanceTimersByTime(10_000);
    const callCountAfter = memento.update.mock.calls.length;
    expect(callCountAfter).toBe(callCountBefore);
    vi.useRealTimers();
  });

  it('persist should be async (returns promise)', async () => {
    // Access persist indirectly by calling remember and advancing timers
    vi.useFakeTimers();
    memory.remember('code', 'async-persist');
    vi.advanceTimersByTime(6000); // trigger debounced persist
    // Wait for any pending promises
    await vi.advanceTimersByTimeAsync(0);
    expect(memento.update).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
