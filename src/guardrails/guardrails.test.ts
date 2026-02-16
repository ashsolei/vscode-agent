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
  window: {
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
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

  describe('dryRun', () => {
    it('should output to constructor stream by default', () => {
      guardrails.dryRun([
        { action: 'create', target: 'file.ts', detail: 'new file' },
      ]);

      expect(mockStream.markdown).toHaveBeenCalled();
      const allText = mockStream.markdown.mock.calls.map((c: any) => c[0]).join('');
      expect(allText).toContain('file.ts');
      expect(allText).toContain('Dry Run');
    });

    it('should output to targetStream when provided', () => {
      const noStreamGuardrails = new GuardRails();
      const targetStream = { markdown: vi.fn(), progress: vi.fn() };

      noStreamGuardrails.dryRun(
        [{ action: 'edit', target: 'app.ts' }],
        targetStream as any
      );

      expect(targetStream.markdown).toHaveBeenCalled();
      const allText = targetStream.markdown.mock.calls.map((c: any) => c[0]).join('');
      expect(allText).toContain('app.ts');
      expect(allText).toContain('Dry Run');
    });

    it('should no-op when no stream available', () => {
      const noStreamGuardrails = new GuardRails();
      // Should not throw
      expect(() => {
        noStreamGuardrails.dryRun([{ action: 'delete', target: 'old.ts' }]);
      }).not.toThrow();
    });

    it('should prefer targetStream over constructor stream', () => {
      const targetStream = { markdown: vi.fn(), progress: vi.fn() };

      guardrails.dryRun(
        [{ action: 'run', target: 'npm test' }],
        targetStream as any
      );

      // targetStream should get the output, not the constructor stream
      expect(targetStream.markdown).toHaveBeenCalled();
      // Constructor stream should NOT get dryRun output
      const constructorCalls = mockStream.markdown.mock.calls.map((c: any) => c[0]).join('');
      expect(constructorCalls).not.toContain('Dry Run');
    });
  });

  describe('markCreated', () => {
    it('should add uris to checkpoint createdFiles', async () => {
      const cp = await guardrails.createCheckpoint('agent', 'test', []);
      const uri1 = { fsPath: '/test/new1.ts', scheme: 'file', path: '/test/new1.ts' };
      const uri2 = { fsPath: '/test/new2.ts', scheme: 'file', path: '/test/new2.ts' };

      guardrails.markCreated(cp.id, [uri1 as any, uri2 as any]);

      const cps = guardrails.listCheckpoints();
      expect(cps[0].createdFiles).toHaveLength(2);
    });

    it('should ignore unknown checkpoint id', () => {
      expect(() => {
        guardrails.markCreated('unknown-id', []);
      }).not.toThrow();
    });
  });

  // ─── Rollback ─── 

  describe('rollback', () => {
    it('should restore files from snapshots', async () => {
      const { workspace } = await import('vscode');
      const cp = await guardrails.createCheckpoint('agent', 'before edit', ['file.ts']);
      
      const result = await guardrails.rollback(cp.id);
      
      expect(result.restoredFiles).toBe(1);
      expect(workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('should delete created files', async () => {
      const { workspace } = await import('vscode');
      const cp = await guardrails.createCheckpoint('agent', 'before create', []);
      const newUri = { fsPath: '/test/new.ts', scheme: 'file', path: '/test/new.ts' };
      guardrails.markCreated(cp.id, [newUri as any]);

      const result = await guardrails.rollback(cp.id);

      expect(result.deletedFiles).toBe(1);
      expect(workspace.fs.delete).toHaveBeenCalledWith(newUri);
    });

    it('should handle both restore and delete together', async () => {
      const cp = await guardrails.createCheckpoint('agent', 'mixed', ['existing.ts']);
      const newUri = { fsPath: '/test/created.ts', scheme: 'file', path: '/test/created.ts' };
      guardrails.markCreated(cp.id, [newUri as any]);

      const result = await guardrails.rollback(cp.id);
      
      expect(result.restoredFiles).toBe(1);
      expect(result.deletedFiles).toBe(1);
    });

    it('should throw for unknown checkpoint id', async () => {
      await expect(guardrails.rollback('unknown')).rejects.toThrow('hittades inte');
    });

    it('should log errors on write failure and continue', async () => {
      const { workspace } = await import('vscode');
      vi.mocked(workspace.fs.writeFile).mockRejectedValueOnce(new Error('Permission denied'));

      const cp = await guardrails.createCheckpoint('agent', 'will fail', ['locked.ts']);
      const result = await guardrails.rollback(cp.id);

      expect(result.restoredFiles).toBe(0);
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Kunde inte återställa'));
    });

    it('should log errors on delete failure and continue', async () => {
      const { workspace } = await import('vscode');
      vi.mocked(workspace.fs.delete).mockRejectedValueOnce(new Error('Not found'));

      const cp = await guardrails.createCheckpoint('agent', 'will fail delete', []);
      const deleteUri = { fsPath: '/test/gone.ts', scheme: 'file', path: '/test/gone.ts' };
      guardrails.markCreated(cp.id, [deleteUri as any]);

      const result = await guardrails.rollback(cp.id);

      expect(result.deletedFiles).toBe(0);
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Kunde inte ta bort'));
    });

    it('should report summary after rollback', async () => {
      const cp = await guardrails.createCheckpoint('agent', 'summary test', ['a.ts']);
      await guardrails.rollback(cp.id);
      
      expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('Rollback klar'));
    });
  });

  // ─── Undo ───

  describe('undo', () => {
    it('should rollback the latest checkpoint and remove it', async () => {
      await guardrails.createCheckpoint('agent', 'first', ['a.ts']);
      await guardrails.createCheckpoint('agent', 'second', ['b.ts']);

      const result = await guardrails.undo();
      
      expect(result).not.toBeNull();
      expect(result!.restoredFiles).toBe(1);
      expect(guardrails.listCheckpoints()).toHaveLength(1);
      expect(guardrails.listCheckpoints()[0].description).toBe('first');
    });

    it('should return null when no checkpoints', async () => {
      const result = await guardrails.undo();
      expect(result).toBeNull();
    });

    it('should allow multiple undo calls', async () => {
      await guardrails.createCheckpoint('agent', 'cp1', []);
      await guardrails.createCheckpoint('agent', 'cp2', []);

      await guardrails.undo();
      expect(guardrails.listCheckpoints()).toHaveLength(1);
      
      await guardrails.undo();
      expect(guardrails.listCheckpoints()).toHaveLength(0);
      
      const result = await guardrails.undo();
      expect(result).toBeNull();
    });
  });

  // ─── confirmDestructive ───

  describe('confirmDestructive', () => {
    it('should return true when user confirms', async () => {
      const { window } = await import('vscode');
      vi.mocked(window.showWarningMessage).mockResolvedValueOnce('Tillåt' as any);

      const result = await guardrails.confirmDestructive('Delete files', ['file1.ts', 'file2.ts']);
      
      expect(result).toBe(true);
      expect(window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Delete files'),
        expect.objectContaining({ modal: true }),
        'Tillåt',
        'Avbryt'
      );
    });

    it('should return false when user cancels', async () => {
      const { window } = await import('vscode');
      vi.mocked(window.showWarningMessage).mockResolvedValueOnce('Avbryt' as any);

      const result = await guardrails.confirmDestructive('Dangerous action', ['detail']);
      expect(result).toBe(false);
    });

    it('should return false when user dismisses dialog', async () => {
      const { window } = await import('vscode');
      vi.mocked(window.showWarningMessage).mockResolvedValueOnce(undefined as any);

      const result = await guardrails.confirmDestructive('Action', ['detail']);
      expect(result).toBe(false);
    });

    it('should truncate details list at 10 items', async () => {
      const { window } = await import('vscode');
      vi.mocked(window.showWarningMessage).mockResolvedValueOnce('Tillåt' as any);

      const details = Array.from({ length: 15 }, (_, i) => `file${i}.ts`);
      await guardrails.confirmDestructive('Mass delete', details);

      const calls = vi.mocked(window.showWarningMessage).mock.calls;
      const call = calls[calls.length - 1];
      const detail = (call[1] as any).detail;
      expect(detail).toContain('och 5 till');
    });
  });

  // ─── clearCheckpoints ───

  describe('clearCheckpoints', () => {
    it('should remove all checkpoints', async () => {
      await guardrails.createCheckpoint('a', 'cp1', []);
      await guardrails.createCheckpoint('b', 'cp2', []);
      expect(guardrails.listCheckpoints()).toHaveLength(2);
      
      guardrails.clearCheckpoints();
      expect(guardrails.listCheckpoints()).toHaveLength(0);
    });
  });

  // ─── Dispose ───

  describe('dispose', () => {
    it('should clear checkpoints and stream', async () => {
      await guardrails.createCheckpoint('agent', 'test', []);
      guardrails.dispose();
      
      expect(guardrails.listCheckpoints()).toHaveLength(0);
    });

    it('should not throw on double dispose', () => {
      guardrails.dispose();
      expect(() => guardrails.dispose()).not.toThrow();
    });
  });
});
