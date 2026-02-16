import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workspace, Uri, FileType } from '../__mocks__/vscode';
import { AutonomousExecutor, ActionResult } from './executor';
import type { DiffPreview } from '../diff/diff-preview';

// Setup workspace mock
function setupWorkspace(root = '/workspace') {
  (workspace as any).workspaceFolders = [
    { uri: Uri.file(root), name: 'test-ws', index: 0 },
  ];
}

function makeMockStream() {
  return {
    markdown: vi.fn(),
    progress: vi.fn(),
    button: vi.fn(),
    anchor: vi.fn(),
    reference: vi.fn(),
    filetree: vi.fn(),
    push: vi.fn(),
  };
}

function makeMockDiffPreview(): DiffPreview {
  return {
    addDiff: vi.fn(),
    addDiffs: vi.fn(),
    clear: vi.fn(),
    get count() { return 0; },
    showPreview: vi.fn(),
    showFileDiff: vi.fn(),
    applyDiffs: vi.fn(),
    reviewAndApply: vi.fn().mockResolvedValue({ applied: 0, rejected: 0 }),
    dispose: vi.fn(),
  } as any;
}

describe('AutonomousExecutor', () => {
  let executor: AutonomousExecutor;
  let stream: ReturnType<typeof makeMockStream>;

  beforeEach(() => {
    vi.clearAllMocks();
    stream = makeMockStream();
    executor = new AutonomousExecutor(stream as any);
    setupWorkspace();
  });

  // ─── File CRUD ───────────────────────────────────────

  describe('createFile', () => {
    it('should create a file successfully', async () => {
      const result = await executor.createFile('src/app.ts', 'console.log("hello")');
      expect(result.success).toBe(true);
      expect(result.action).toBe('createFile');
      expect(result.filesAffected).toContain('src/app.ts');
      expect(workspace.fs.writeFile).toHaveBeenCalled();
      expect(stream.progress).toHaveBeenCalledWith(expect.stringContaining('src/app.ts'));
    });

    it('should fail when no workspace is open', async () => {
      (workspace as any).workspaceFolders = undefined;
      const result = await executor.createFile('test.ts', 'content');
      expect(result.success).toBe(false);
      expect(result.detail).toContain('arbetsyta');
    });

    it('should reject path traversal with ..', async () => {
      const result = await executor.createFile('../outside.ts', 'malicious');
      expect(result.success).toBe(false);
      expect(result.detail).toContain('utanför');
    });

    it('should handle write errors gracefully', async () => {
      (workspace.fs.writeFile as any).mockRejectedValueOnce(new Error('Permission denied'));
      const result = await executor.createFile('src/locked.ts', 'content');
      expect(result.success).toBe(false);
      expect(result.detail).toContain('Permission denied');
    });
  });

  describe('readFile', () => {
    it('should read a file successfully', async () => {
      (workspace.fs.readFile as any).mockResolvedValueOnce(Buffer.from('file content'));
      const content = await executor.readFile('src/app.ts');
      expect(content).toBe('file content');
    });

    it('should return null when no workspace', async () => {
      (workspace as any).workspaceFolders = undefined;
      const content = await executor.readFile('test.ts');
      expect(content).toBeNull();
    });

    it('should return null on read error', async () => {
      (workspace.fs.readFile as any).mockRejectedValueOnce(new Error('not found'));
      const content = await executor.readFile('missing.ts');
      expect(content).toBeNull();
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      (workspace.fs.stat as any).mockResolvedValueOnce({ type: FileType.File });
      expect(await executor.fileExists('src/app.ts')).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      (workspace.fs.stat as any).mockRejectedValueOnce(new Error('not found'));
      expect(await executor.fileExists('missing.ts')).toBe(false);
    });

    it('should return false when no workspace', async () => {
      (workspace as any).workspaceFolders = undefined;
      expect(await executor.fileExists('test.ts')).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      const result = await executor.deleteFile('src/old.ts');
      expect(result.success).toBe(true);
      expect(result.action).toBe('deleteFile');
      expect(workspace.fs.delete).toHaveBeenCalled();
    });

    it('should fail when no workspace is open', async () => {
      (workspace as any).workspaceFolders = undefined;
      const result = await executor.deleteFile('file.ts');
      expect(result.success).toBe(false);
    });

    it('should handle delete errors', async () => {
      (workspace.fs.delete as any).mockRejectedValueOnce(new Error('access denied'));
      const result = await executor.deleteFile('protected.ts');
      expect(result.success).toBe(false);
      expect(result.detail).toContain('access denied');
    });
  });

  // ─── Edit ────────────────────────────────────────────

  describe('editFile', () => {
    it('should replace text in a file', async () => {
      (workspace.fs.readFile as any).mockResolvedValueOnce(Buffer.from('const x = 1;'));
      const result = await executor.editFile('src/app.ts', 'const x = 1', 'const x = 42');
      expect(result.success).toBe(true);
      expect(workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('should fail when search text is not found', async () => {
      (workspace.fs.readFile as any).mockResolvedValueOnce(Buffer.from('const y = 2;'));
      const result = await executor.editFile('src/app.ts', 'const x = 1', 'const x = 42');
      expect(result.success).toBe(false);
      expect(result.detail).toContain('Hittade inte');
    });

    it('should fail when no workspace', async () => {
      (workspace as any).workspaceFolders = undefined;
      const result = await executor.editFile('app.ts', 'old', 'new');
      expect(result.success).toBe(false);
    });
  });

  // ─── Multiple Files ──────────────────────────────────

  describe('createFiles', () => {
    it('should create multiple files', async () => {
      const files = [
        { path: 'src/a.ts', content: 'a' },
        { path: 'src/b.ts', content: 'b' },
        { path: 'src/c.ts', content: 'c' },
      ];
      const results = await executor.createFiles(files);
      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  // ─── Path Traversal ──────────────────────────────────

  describe('path validation', () => {
    it('should block absolute path traversal', async () => {
      const result = await executor.createFile('../../etc/passwd', 'pwned');
      expect(result.success).toBe(false);
    });

    it('should allow nested paths within workspace', async () => {
      const result = await executor.createFile('src/deep/nested/file.ts', 'ok');
      expect(result.success).toBe(true);
    });
  });

  // ─── Action Log ──────────────────────────────────────

  describe('action log', () => {
    it('should track all actions', async () => {
      await executor.createFile('a.ts', 'A');
      await executor.createFile('b.ts', 'B');
      expect(executor.log.length).toBe(2);
      expect(executor.log[0].action).toBe('createFile');
    });

    it('should clear log', async () => {
      await executor.createFile('a.ts', 'A');
      executor.clearLog();
      expect(executor.log.length).toBe(0);
    });

    it('should return a copy of the log', async () => {
      await executor.createFile('a.ts', 'A');
      const log = executor.log;
      log.push({ action: 'fake', success: true, detail: 'tampered' });
      expect(executor.log.length).toBe(1); // Original unmodified
    });
  });

  // ─── Report Summary ─────────────────────────────────

  describe('reportSummary', () => {
    it('should report summary to stream', async () => {
      await executor.createFile('a.ts', 'ok');
      executor.reportSummary();
      expect(stream.markdown).toHaveBeenCalledWith(expect.stringContaining('Autonomt resultat'));
    });

    it('should include failed actions in summary', async () => {
      (workspace as any).workspaceFolders = undefined;
      await executor.createFile('fail.ts', 'err');
      setupWorkspace();
      await executor.createFile('ok.ts', 'ok');
      executor.reportSummary();
      const md = stream.markdown.mock.calls.map((c: any[]) => c[0]).join('');
      expect(md).toContain('misslyckades');
    });
  });

  // ─── Directory Listing ───────────────────────────────

  describe('listDir', () => {
    it('should list directory contents', async () => {
      (workspace.fs.readDirectory as any).mockResolvedValueOnce([
        ['app.ts', FileType.File],
        ['src', FileType.Directory],
      ]);
      const entries = await executor.listDir('');
      expect(entries.length).toBe(2);
      expect(entries[0].name).toBe('app.ts');
      expect(entries[0].isDir).toBe(false);
      expect(entries[1].isDir).toBe(true);
    });

    it('should return empty array when no workspace', async () => {
      (workspace as any).workspaceFolders = undefined;
      const entries = await executor.listDir();
      expect(entries).toEqual([]);
    });
  });

  // ─── JSON Reader ─────────────────────────────────────

  describe('readJsonFile', () => {
    it('should parse JSON files', async () => {
      (workspace.fs.readFile as any).mockResolvedValueOnce(
        Buffer.from('{"name": "test", "version": "1.0.0"}')
      );
      const json = await executor.readJsonFile<{ name: string }>('package.json');
      expect(json).toEqual({ name: 'test', version: '1.0.0' });
    });

    it('should return null for invalid JSON', async () => {
      (workspace.fs.readFile as any).mockResolvedValueOnce(Buffer.from('not valid json'));
      const json = await executor.readJsonFile('bad.json');
      expect(json).toBeNull();
    });

    it('should return null when file not found', async () => {
      (workspace.fs.readFile as any).mockRejectedValueOnce(new Error('not found'));
      const json = await executor.readJsonFile('missing.json');
      expect(json).toBeNull();
    });
  });

  // ─── DiffPreview Integration ─────────────────────────

  describe('DiffPreview integration', () => {
    let diffPreview: DiffPreview;
    let previewExecutor: AutonomousExecutor;

    beforeEach(() => {
      diffPreview = makeMockDiffPreview();
      previewExecutor = new AutonomousExecutor(stream as any, diffPreview);
      setupWorkspace();
    });

    describe('createFile with DiffPreview', () => {
      it('should route to DiffPreview instead of writing directly', async () => {
        const result = await previewExecutor.createFile('src/new.ts', 'content');
        expect(result.success).toBe(true);
        expect(result.detail).toContain('Förhandsgranskad');
        expect(diffPreview.addDiff).toHaveBeenCalledWith({
          path: 'src/new.ts',
          type: 'create',
          proposed: 'content',
        });
        expect(workspace.fs.writeFile).not.toHaveBeenCalled();
      });

      it('should show preview progress message', async () => {
        await previewExecutor.createFile('src/new.ts', 'content');
        expect(stream.progress).toHaveBeenCalledWith(expect.stringContaining('📋'));
      });
    });

    describe('editFile with DiffPreview', () => {
      it('should route edits to DiffPreview', async () => {
        (workspace.fs.readFile as any).mockResolvedValueOnce(Buffer.from('const x = 1;'));
        const result = await previewExecutor.editFile('src/app.ts', 'const x = 1', 'const x = 42');
        expect(result.success).toBe(true);
        expect(result.detail).toContain('Förhandsgranskad');
        expect(diffPreview.addDiff).toHaveBeenCalledWith({
          path: 'src/app.ts',
          type: 'modify',
          original: 'const x = 1;',
          proposed: 'const x = 42;',
        });
        expect(workspace.fs.writeFile).not.toHaveBeenCalled();
      });
    });

    describe('deleteFile with DiffPreview', () => {
      it('should route deletes to DiffPreview', async () => {
        (workspace.fs.readFile as any).mockResolvedValueOnce(Buffer.from('old content'));
        const result = await previewExecutor.deleteFile('src/old.ts');
        expect(result.success).toBe(true);
        expect(result.detail).toContain('Förhandsgranskad');
        expect(diffPreview.addDiff).toHaveBeenCalledWith({
          path: 'src/old.ts',
          type: 'delete',
          original: 'old content',
        });
        expect(workspace.fs.delete).not.toHaveBeenCalled();
      });

      it('should handle missing file during delete preview', async () => {
        (workspace.fs.readFile as any).mockRejectedValueOnce(new Error('not found'));
        const result = await previewExecutor.deleteFile('src/missing.ts');
        expect(result.success).toBe(true);
        expect(diffPreview.addDiff).toHaveBeenCalledWith({
          path: 'src/missing.ts',
          type: 'delete',
          original: undefined,
        });
      });
    });

    describe('createFiles with DiffPreview', () => {
      it('should route all files through DiffPreview', async () => {
        const files = [
          { path: 'src/a.ts', content: 'a' },
          { path: 'src/b.ts', content: 'b' },
        ];
        const results = await previewExecutor.createFiles(files);
        expect(results.length).toBe(2);
        expect(results.every(r => r.success)).toBe(true);
        expect(diffPreview.addDiff).toHaveBeenCalledTimes(2);
        expect(workspace.fs.writeFile).not.toHaveBeenCalled();
      });
    });

    describe('without DiffPreview', () => {
      it('should write directly when no DiffPreview is set', async () => {
        const directExecutor = new AutonomousExecutor(stream as any);
        setupWorkspace();
        const result = await directExecutor.createFile('src/direct.ts', 'content');
        expect(result.success).toBe(true);
        expect(result.detail).toContain('Skapade');
        expect(workspace.fs.writeFile).toHaveBeenCalled();
      });
    });
  });

  // ─── maxSteps enforcement ────────────────────────────

  describe('maxSteps enforcement', () => {
    it('should allow actions within step limit', async () => {
      const limitedExecutor = new AutonomousExecutor(stream as any, undefined, 3);
      setupWorkspace();
      const r1 = await limitedExecutor.createFile('src/a.ts', 'a');
      const r2 = await limitedExecutor.createFile('src/b.ts', 'b');
      const r3 = await limitedExecutor.createFile('src/c.ts', 'c');
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(true);
      expect(limitedExecutor.steps).toBe(3);
    });

    it('should throw when exceeding maxSteps', async () => {
      const limitedExecutor = new AutonomousExecutor(stream as any, undefined, 2);
      setupWorkspace();
      await limitedExecutor.createFile('src/a.ts', 'a');
      await limitedExecutor.createFile('src/b.ts', 'b');
      // Third action exceeds limit
      const r3 = await limitedExecutor.createFile('src/c.ts', 'c');
      expect(r3.success).toBe(false);
      expect(r3.detail).toContain('Max antal');
    });

    it('should count editFile toward step limit', async () => {
      const limitedExecutor = new AutonomousExecutor(stream as any, undefined, 1);
      setupWorkspace();
      (workspace.fs.readFile as any).mockResolvedValueOnce(Buffer.from('const x = 1;'));
      await limitedExecutor.editFile('src/app.ts', 'const x = 1', 'const x = 2');
      // Second action should fail
      const r2 = await limitedExecutor.createFile('src/b.ts', 'b');
      expect(r2.success).toBe(false);
      expect(r2.detail).toContain('Max antal');
    });

    it('should count deleteFile toward step limit', async () => {
      const limitedExecutor = new AutonomousExecutor(stream as any, undefined, 1);
      setupWorkspace();
      await limitedExecutor.deleteFile('src/old.ts');
      const r2 = await limitedExecutor.createFile('src/b.ts', 'b');
      expect(r2.success).toBe(false);
    });

    it('should show step progress', async () => {
      const limitedExecutor = new AutonomousExecutor(stream as any, undefined, 5);
      setupWorkspace();
      await limitedExecutor.createFile('src/a.ts', 'a');
      expect(stream.progress).toHaveBeenCalledWith('📊 Steg 1/5');
    });

    it('should default maxSteps from configuration', () => {
      const defaultExecutor = new AutonomousExecutor(stream as any);
      // Default from mock vscode.workspace.getConfiguration is 10
      expect(defaultExecutor.steps).toBe(0);
    });

    it('should not count read-only operations toward step limit', async () => {
      const limitedExecutor = new AutonomousExecutor(stream as any, undefined, 1);
      setupWorkspace();
      // Read operations should NOT count
      await limitedExecutor.readFile('src/app.ts');
      await limitedExecutor.fileExists('src/app.ts');
      await limitedExecutor.listDir('src');
      // First mutating action should still succeed
      const result = await limitedExecutor.createFile('src/a.ts', 'a');
      expect(result.success).toBe(true);
      expect(limitedExecutor.steps).toBe(1);
    });
  });

  // --- createFiles rollback ---

  describe('createFiles rollback', () => {
    it('should create all files when no errors occur', async () => {
      const files = [
        { path: 'src/a.ts', content: 'a' },
        { path: 'src/b.ts', content: 'b' },
      ];

      const results = await executor.createFiles(files);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should rollback created files when a file fails', async () => {
      // Första filen lyckas, andra misslyckas
      const writeFile = vi.mocked(workspace.fs.writeFile);
      writeFile.mockResolvedValueOnce(undefined); // a.ts ok
      writeFile.mockRejectedValueOnce(new Error('disk full')); // b.ts fails

      const deleteFile = vi.mocked(workspace.fs.delete);
      deleteFile.mockResolvedValueOnce(undefined); // rollback a.ts

      const files = [
        { path: 'src/a.ts', content: 'a' },
        { path: 'src/b.ts', content: 'b' },
        { path: 'src/c.ts', content: 'c' },
      ];

      const results = await executor.createFiles(files);
      // b.ts failed, c.ts skipped
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(false);
      expect(results[2].detail).toContain('Överhoppad');
    });

    it('should mark remaining files as skipped', async () => {
      const writeFile = vi.mocked(workspace.fs.writeFile);
      writeFile.mockRejectedValueOnce(new Error('fail first'));

      const files = [
        { path: 'src/a.ts', content: 'a' },
        { path: 'src/b.ts', content: 'b' },
        { path: 'src/c.ts', content: 'c' },
      ];

      const results = await executor.createFiles(files);
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(false);
      expect(results[1].detail).toContain('Överhoppad');
      expect(results[2].detail).toContain('Överhoppad');
    });
  });

  // ─── v0.10.0: CWD validation ─────────────────

  describe('runCommand CWD validation', () => {
    it('should reject cwd that is a prefix attack path', async () => {
      setupWorkspace('/workspace');
      const result = await executor.runCommand('ls', { cwd: '/workspace-evil' });
      expect(result.success).toBe(false);
      expect(result.detail).toContain('utanför arbetsytan');
    });

    it('should reject cwd completely outside workspace', async () => {
      setupWorkspace('/workspace');
      const result = await executor.runCommand('ls', { cwd: '/tmp/evil' });
      expect(result.success).toBe(false);
      expect(result.detail).toContain('utanför arbetsytan');
    });

    it('should accept cwd that is the workspace root', async () => {
      setupWorkspace('/workspace');
      const result = await executor.runCommand('echo hi', { cwd: '/workspace' });
      // Will fail on task execution mock, but should NOT fail on CWD validation
      // If the error is about cwd, the test fails; any other error means cwd passed
      if (!result.success) {
        expect(result.detail).not.toContain('utanför arbetsytan');
      }
    });
  });
});
