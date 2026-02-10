import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuardRails } from './guardrails';
import type { Checkpoint } from './guardrails';

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test', scheme: 'file', path: '/test' } }],
    fs: {
      readFile: vi.fn().mockResolvedValue(new Uint8Array([104, 101, 108, 108, 111])), // 'hello'
      writeFile: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
  Uri: {
    joinPath: vi.fn((_base: any, path: string) => ({
      fsPath: `/test/${path}`,
      scheme: 'file',
      path: `/test/${path}`,
    })),
  },
}));

describe('GuardRails', () => {
  let guardrails: GuardRails;
  const mockStream = { progress: vi.fn(), markdown: vi.fn() };

  beforeEach(() => {
    guardrails = new GuardRails(mockStream as any);
    mockStream.progress.mockClear();
    mockStream.markdown.mockClear();
  });

  it('creates a checkpoint with file snapshots', async () => {
    const cp = await guardrails.createCheckpoint(
      'test-agent',
      'Before edit',
      ['file.ts']
    );

    expect(cp.id).toMatch(/^cp-/);
    expect(cp.agentId).toBe('test-agent');
    expect(cp.description).toBe('Before edit');
    expect(cp.snapshots).toHaveLength(1);
    expect(mockStream.progress).toHaveBeenCalled();
  });

  it('returns empty list initially', () => {
    expect(guardrails.listCheckpoints()).toEqual([]);
  });

  it('stores multiple checkpoints', async () => {
    await guardrails.createCheckpoint('a', 'cp1', ['f1.ts']);
    await guardrails.createCheckpoint('b', 'cp2', ['f2.ts']);

    const cps = guardrails.listCheckpoints();
    expect(cps).toHaveLength(2);
    expect(cps[0].description).toBe('cp1');
    expect(cps[1].description).toBe('cp2');
  });

  it('limits checkpoints to MAX_CHECKPOINTS', async () => {
    // Create 55 checkpoints (max is 50)
    for (let i = 0; i < 55; i++) {
      await guardrails.createCheckpoint('agent', `cp-${i}`, []);
    }

    expect(guardrails.listCheckpoints().length).toBeLessThanOrEqual(50);
  });
});
