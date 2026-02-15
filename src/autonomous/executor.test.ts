import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workspace, Uri, FileType } from '../__mocks__/vscode';
import { AutonomousExecutor, ActionResult } from './executor';

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
});
