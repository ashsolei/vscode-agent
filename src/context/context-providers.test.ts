import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { ContextProviderRegistry, ContextChunk } from './context-providers';

// ─── Helpers ────────────────────────────────────────

/** Skapa en minimal ContextChunk med rimliga defaults. */
function makeChunk(overrides: Partial<ContextChunk> = {}): ContextChunk {
  return {
    type: 'custom',
    label: 'Test',
    content: 'test content',
    priority: 50,
    tokenEstimate: 10,
    ...overrides,
  };
}

/** Setup a fake git extension that is active + has repos. */
function setupGitExtension(opts: {
  diff?: string;
  diffUnstaged?: string;
  log?: any[];
} = {}) {
  const repo = {
    diff: vi.fn().mockImplementation((staged: boolean) =>
      Promise.resolve(staged ? (opts.diff ?? '') : (opts.diffUnstaged ?? ''))
    ),
    log: vi.fn().mockResolvedValue(opts.log ?? []),
  };

  vi.mocked(vscode.extensions.getExtension).mockReturnValue({
    isActive: true,
    exports: { getAPI: () => ({ repositories: [repo] }) },
  } as any);

  return repo;
}

/** Setup workspace folders so workspace-info + dependencies providers work. */
function setupWorkspaceFolder(name = 'my-project', fsPath = '/workspace/my-project') {
  const uri = vscode.Uri.file(fsPath);
  (vscode.workspace as any).workspaceFolders = [{ name, uri, index: 0 }];
  return uri;
}

// ─── Tests ──────────────────────────────────────────

describe('ContextProviderRegistry', () => {
  let registry: ContextProviderRegistry;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Reset workspace state to clean defaults
    (vscode.workspace as any).workspaceFolders = undefined;
    (vscode.window as any).activeTextEditor = undefined;
    (vscode.window as any).visibleTextEditors = [];
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
    vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([]);
    vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([]);
    vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(new Error('not found'));
    vi.mocked(vscode.workspace.asRelativePath).mockImplementation(
      (uri: any) => (typeof uri === 'string' ? uri : uri?.fsPath ?? '')
    );

    registry = new ContextProviderRegistry();
  });

  afterEach(() => {
    registry.dispose();
  });

  // ─── 1. Constructor & defaults ──────────────────

  describe('constructor and defaults', () => {
    it('should create an instance without errors', () => {
      expect(registry).toBeInstanceOf(ContextProviderRegistry);
    });

    it('should register built-in providers in constructor', async () => {
      // Built-ins: git-diff, open-files, diagnostics, workspace-info, selection, git-log, dependencies
      // Calling gather with all providers returning null should still work
      const chunks = await registry.gather();
      expect(chunks).toEqual([]);
    });
  });

  // ─── 2. register() ─────────────────────────────

  describe('register()', () => {
    it('should register a custom provider and include its output in gather()', async () => {
      registry.register('custom-1', async () => makeChunk({
        label: 'Custom Provider',
        content: 'hello from custom',
        priority: 80,
      }));

      const chunks = await registry.gather();
      expect(chunks.some(c => c.label === 'Custom Provider')).toBe(true);
    });

    it('should allow overwriting an existing provider', async () => {
      registry.register('custom-1', async () => makeChunk({ content: 'first' }));
      registry.register('custom-1', async () => makeChunk({ content: 'second' }));

      const chunks = await registry.gather();
      const custom = chunks.filter(c => c.type === 'custom');
      expect(custom).toHaveLength(1);
      expect(custom[0].content).toBe('second');
    });
  });

  // ─── 3. unregister() ───────────────────────────

  describe('unregister()', () => {
    it('should remove a previously registered provider', async () => {
      registry.register('temp', async () => makeChunk({ label: 'Temporary' }));

      // Verify it's there
      let chunks = await registry.gather();
      expect(chunks.some(c => c.label === 'Temporary')).toBe(true);

      registry.invalidate();
      registry.unregister('temp');

      chunks = await registry.gather();
      expect(chunks.some(c => c.label === 'Temporary')).toBe(false);
    });

    it('should not throw when unregistering a non-existent provider', () => {
      expect(() => registry.unregister('does-not-exist')).not.toThrow();
    });

    it('should allow unregistering a built-in provider', async () => {
      registry.unregister('git-diff');
      registry.unregister('open-files');
      registry.unregister('diagnostics');
      registry.unregister('workspace-info');
      registry.unregister('selection');
      registry.unregister('git-log');
      registry.unregister('dependencies');

      const chunks = await registry.gather();
      expect(chunks).toEqual([]);
    });
  });

  // ─── 4. buildPromptContext() ────────────────────

  describe('buildPromptContext()', () => {
    it('should return empty string when no providers produce output', async () => {
      const result = await registry.buildPromptContext();
      expect(result).toBe('');
    });

    it('should build formatted markdown with sections from providers', async () => {
      registry.register('custom-a', async () => makeChunk({
        label: 'Alpha',
        content: 'alpha content',
        priority: 90,
      }));
      registry.register('custom-b', async () => makeChunk({
        label: 'Beta',
        content: 'beta content',
        priority: 70,
      }));

      const result = await registry.buildPromptContext();

      expect(result).toContain('## 📋 Arbetsytekontext');
      expect(result).toContain('### Alpha');
      expect(result).toContain('alpha content');
      expect(result).toContain('### Beta');
      expect(result).toContain('beta content');
    });

    it('should sort sections by priority (highest first)', async () => {
      registry.register('low', async () => makeChunk({ label: 'Low', priority: 10, content: 'low' }));
      registry.register('high', async () => makeChunk({ label: 'High', priority: 99, content: 'high' }));
      registry.register('mid', async () => makeChunk({ label: 'Mid', priority: 50, content: 'mid' }));

      const result = await registry.buildPromptContext();
      const highIndex = result.indexOf('### High');
      const midIndex = result.indexOf('### Mid');
      const lowIndex = result.indexOf('### Low');

      expect(highIndex).toBeLessThan(midIndex);
      expect(midIndex).toBeLessThan(lowIndex);
    });

    it('should wrap content in code blocks', async () => {
      registry.register('wrapper', async () => makeChunk({
        label: 'Wrapped',
        content: 'some code',
      }));

      const result = await registry.buildPromptContext();
      expect(result).toContain('```\nsome code\n```');
    });
  });

  // ─── 5. buildPromptContext() with maxLength / token truncation ────

  describe('buildPromptContext() with maxLength truncation', () => {
    it('should respect maxTokens budget', async () => {
      registry.register('big', async () => makeChunk({
        label: 'Big',
        content: 'A'.repeat(2000),
        priority: 80,
        tokenEstimate: 500,
      }));
      registry.register('small', async () => makeChunk({
        label: 'Small',
        content: 'B'.repeat(100),
        priority: 70,
        tokenEstimate: 25,
      }));

      // Budget of 510 tokens should fit 'big' (500) but leave only 10 for 'small'
      // 10 tokens < 100 threshold → 'small' gets trimmed or dropped
      const chunks = await registry.gather(510);
      // 'big' should be present
      expect(chunks.some(c => c.label === 'Big')).toBe(true);
    });

    it('should trim a chunk when partially fitting', async () => {
      registry.register('trimme', async () => makeChunk({
        label: 'Trim Me',
        content: 'X'.repeat(4000),
        priority: 80,
        tokenEstimate: 1000,
      }));

      // Budget < tokenEstimate → content must be trimmed
      const chunks = await registry.gather(500);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content.length).toBeLessThan(4000);
    });

    it('should drop a chunk if remaining budget < 100 tokens', async () => {
      registry.register('filler', async () => makeChunk({
        label: 'Filler',
        content: 'F'.repeat(400),
        priority: 90,
        tokenEstimate: 100,
      }));
      registry.register('dropper', async () => makeChunk({
        label: 'Dropped',
        content: 'D'.repeat(400),
        priority: 80,
        tokenEstimate: 100,
      }));

      // Budget 150 → filler (100) fits, only 50 remaining which < 100 → dropper skipped
      const chunks = await registry.gather(150);
      expect(chunks.some(c => c.label === 'Filler')).toBe(true);
      expect(chunks.some(c => c.label === 'Dropped')).toBe(false);
    });

    it('should keep multiple chunks that fit within the budget', async () => {
      registry.register('a', async () => makeChunk({ label: 'A', tokenEstimate: 100, priority: 90 }));
      registry.register('b', async () => makeChunk({ label: 'B', tokenEstimate: 100, priority: 80 }));
      registry.register('c', async () => makeChunk({ label: 'C', tokenEstimate: 100, priority: 70 }));

      const chunks = await registry.gather(500);
      expect(chunks).toHaveLength(3);
    });
  });

  // ─── 6. Error handling ──────────────────────────

  describe('error handling in individual providers', () => {
    it('should not crash when a provider throws', async () => {
      registry.register('bad', async () => { throw new Error('boom'); });
      registry.register('good', async () => makeChunk({ label: 'Good' }));

      const chunks = await registry.gather();
      // 'bad' rejected, 'good' fulfilled
      expect(chunks.some(c => c.label === 'Good')).toBe(true);
    });

    it('should not crash when all providers throw', async () => {
      registry.register('bad1', async () => { throw new Error('err1'); });
      registry.register('bad2', async () => { throw new Error('err2'); });

      const chunks = await registry.gather();
      expect(chunks).toEqual([]);
    });

    it('should skip providers returning null', async () => {
      registry.register('nil', async () => null);
      registry.register('valid', async () => makeChunk({ label: 'Valid' }));

      const chunks = await registry.gather();
      expect(chunks).toHaveLength(1);
      expect(chunks[0].label).toBe('Valid');
    });

    it('should skip providers returning empty content', async () => {
      registry.register('empty', async () => makeChunk({ content: '   ' }));
      registry.register('present', async () => makeChunk({ label: 'Present', content: 'real' }));

      const chunks = await registry.gather();
      expect(chunks).toHaveLength(1);
      expect(chunks[0].label).toBe('Present');
    });
  });

  // ─── 7. dispose() cleanup ──────────────────────

  describe('dispose()', () => {
    it('should clear all providers', async () => {
      registry.register('extra', async () => makeChunk({ label: 'Extra' }));
      registry.dispose();

      // After dispose, gather finds no providers at all
      // (We need to invalidate cache because dispose does not clear it; but providers.clear() means gather returns [])
      registry.invalidate();
      const chunks = await registry.gather();
      expect(chunks).toEqual([]);
    });

    it('should be callable multiple times without error', () => {
      expect(() => {
        registry.dispose();
        registry.dispose();
      }).not.toThrow();
    });
  });

  // ─── 8. Default (built-in) providers ───────────

  describe('built-in: git-diff', () => {
    it('should return null when git extension is absent', async () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'git-diff')).toBe(false);
    });

    it('should return null when git extension is not active', async () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({ isActive: false } as any);
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'git-diff')).toBe(false);
    });

    it('should return combined staged + unstaged diff', async () => {
      setupGitExtension({ diff: '+added line', diffUnstaged: '-removed line' });
      registry.invalidate();

      const chunks = await registry.gather();
      const diffChunk = chunks.find(c => c.type === 'git-diff');
      expect(diffChunk).toBeDefined();
      expect(diffChunk!.content).toContain('+added line');
      expect(diffChunk!.content).toContain('-removed line');
      expect(diffChunk!.priority).toBe(90);
    });

    it('should return null when diff is empty', async () => {
      setupGitExtension({ diff: '', diffUnstaged: '' });
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'git-diff')).toBe(false);
    });

    it('should truncate diff to 3000 chars', async () => {
      const longDiff = 'X'.repeat(5000);
      setupGitExtension({ diff: longDiff });
      registry.invalidate();

      const chunks = await registry.gather();
      const diffChunk = chunks.find(c => c.type === 'git-diff');
      expect(diffChunk).toBeDefined();
      expect(diffChunk!.content.length).toBeLessThanOrEqual(3000);
    });
  });

  describe('built-in: open-files', () => {
    it('should return null when no editors are visible', async () => {
      (vscode.window as any).visibleTextEditors = [];
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'open-files')).toBe(false);
    });

    it('should list visible editors', async () => {
      (vscode.window as any).visibleTextEditors = [
        {
          document: {
            uri: vscode.Uri.file('/workspace/src/foo.ts'),
            languageId: 'typescript',
            lineCount: 42,
          },
        },
        {
          document: {
            uri: vscode.Uri.file('/workspace/README.md'),
            languageId: 'markdown',
            lineCount: 10,
          },
        },
      ];
      vi.mocked(vscode.workspace.asRelativePath)
        .mockImplementation((uri: any) => {
          const p = typeof uri === 'string' ? uri : uri?.fsPath ?? '';
          return p.replace('/workspace/', '');
        });
      registry.invalidate();

      const chunks = await registry.gather();
      const openFiles = chunks.find(c => c.type === 'open-files');
      expect(openFiles).toBeDefined();
      expect(openFiles!.content).toContain('src/foo.ts');
      expect(openFiles!.content).toContain('typescript');
      expect(openFiles!.content).toContain('42');
      expect(openFiles!.content).toContain('README.md');
      expect(openFiles!.priority).toBe(70);
    });
  });

  describe('built-in: diagnostics', () => {
    it('should return null when no diagnostics exist', async () => {
      vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([]);
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'diagnostics')).toBe(false);
    });

    it('should include errors with highest priority', async () => {
      vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([
        [
          vscode.Uri.file('/workspace/app.ts'),
          [
            {
              severity: vscode.DiagnosticSeverity.Error,
              message: 'Type mismatch',
              range: { start: { line: 9, character: 0 }, end: { line: 9, character: 10 } },
            },
          ],
        ],
      ] as any);
      registry.invalidate();

      const chunks = await registry.gather();
      const diag = chunks.find(c => c.type === 'diagnostics');
      expect(diag).toBeDefined();
      expect(diag!.content).toContain('[ERR]');
      expect(diag!.content).toContain('Type mismatch');
      expect(diag!.content).toContain(':10');
      expect(diag!.priority).toBe(95);
    });

    it('should include warnings', async () => {
      vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([
        [
          vscode.Uri.file('/workspace/util.ts'),
          [
            {
              severity: vscode.DiagnosticSeverity.Warning,
              message: 'Unused variable',
              range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } },
            },
          ],
        ],
      ] as any);
      registry.invalidate();

      const chunks = await registry.gather();
      const diag = chunks.find(c => c.type === 'diagnostics');
      expect(diag).toBeDefined();
      expect(diag!.content).toContain('[WARN]');
      expect(diag!.content).toContain('Unused variable');
    });

    it('should show both errors and warnings', async () => {
      vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([
        [
          vscode.Uri.file('/workspace/x.ts'),
          [
            {
              severity: vscode.DiagnosticSeverity.Error,
              message: 'err1',
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
            },
            {
              severity: vscode.DiagnosticSeverity.Warning,
              message: 'warn1',
              range: { start: { line: 5, character: 0 }, end: { line: 5, character: 1 } },
            },
          ],
        ],
      ] as any);
      registry.invalidate();

      const chunks = await registry.gather();
      const diag = chunks.find(c => c.type === 'diagnostics');
      expect(diag).toBeDefined();
      expect(diag!.content).toContain('err1');
      expect(diag!.content).toContain('warn1');
      expect(diag!.label).toContain('1 fel');
      expect(diag!.label).toContain('1 varningar');
    });
  });

  describe('built-in: workspace-info', () => {
    it('should return null when no workspace folder', async () => {
      (vscode.workspace as any).workspaceFolders = undefined;
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'workspace-info')).toBe(false);
    });

    it('should return workspace name and path', async () => {
      setupWorkspaceFolder('my-app', '/home/user/my-app');
      vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([]);
      registry.invalidate();

      const chunks = await registry.gather();
      const ws = chunks.find(c => c.type === 'workspace-info');
      expect(ws).toBeDefined();
      expect(ws!.content).toContain('my-app');
      expect(ws!.priority).toBe(50);
    });

    it('should detect Node.js/TypeScript project from root files', async () => {
      setupWorkspaceFolder();
      vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
        ['package.json', vscode.FileType.File],
        ['tsconfig.json', vscode.FileType.File],
        ['.git', vscode.FileType.Directory],
        ['src', vscode.FileType.Directory],
      ] as any);
      registry.invalidate();

      const chunks = await registry.gather();
      const ws = chunks.find(c => c.type === 'workspace-info');
      expect(ws).toBeDefined();
      expect(ws!.content).toContain('Node.js/JavaScript');
      expect(ws!.content).toContain('TypeScript');
      expect(ws!.content).toContain('Git');
    });

    it('should detect Python project', async () => {
      setupWorkspaceFolder();
      vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
        ['requirements.txt', vscode.FileType.File],
      ] as any);
      registry.invalidate();

      const chunks = await registry.gather();
      const ws = chunks.find(c => c.type === 'workspace-info');
      expect(ws).toBeDefined();
      expect(ws!.content).toContain('Python');
    });

    it('should survive readDirectory errors gracefully', async () => {
      setupWorkspaceFolder();
      vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValue(new Error('ENOENT'));
      registry.invalidate();

      const chunks = await registry.gather();
      // workspace-info should still return basic info (name + path)
      const ws = chunks.find(c => c.type === 'workspace-info');
      expect(ws).toBeDefined();
    });
  });

  describe('built-in: selection', () => {
    it('should return null when no active editor', async () => {
      (vscode.window as any).activeTextEditor = undefined;
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'selection')).toBe(false);
    });

    it('should return null when selection is empty', async () => {
      (vscode.window as any).activeTextEditor = {
        selection: new vscode.Selection(
          new vscode.Position(0, 0),
          new vscode.Position(0, 0),
        ),
        document: {
          uri: vscode.Uri.file('/workspace/foo.ts'),
          getText: vi.fn().mockReturnValue(''),
        },
      };
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'selection')).toBe(false);
    });

    it('should return selected text with highest priority', async () => {
      const sel = new vscode.Selection(
        new vscode.Position(2, 0),
        new vscode.Position(5, 10),
      );
      (vscode.window as any).activeTextEditor = {
        selection: sel,
        document: {
          uri: vscode.Uri.file('/workspace/main.ts'),
          getText: vi.fn().mockReturnValue('const x = 42;'),
        },
      };
      registry.invalidate();

      const chunks = await registry.gather();
      const selChunk = chunks.find(c => c.type === 'selection');
      expect(selChunk).toBeDefined();
      expect(selChunk!.content).toBe('const x = 42;');
      expect(selChunk!.priority).toBe(100);
      expect(selChunk!.label).toContain('Markerad kod');
    });
  });

  describe('built-in: git-log', () => {
    it('should return null when git extension is absent', async () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'git-log')).toBe(false);
    });

    it('should return recent commits', async () => {
      setupGitExtension({
        log: [
          { hash: 'abc1234567', message: 'feat: add feature', authorName: 'Alice' },
          { hash: 'def7654321', message: 'fix: bug fix', authorName: 'Bob' },
        ],
      });
      registry.invalidate();

      const chunks = await registry.gather();
      const logChunk = chunks.find(c => c.type === 'git-log');
      expect(logChunk).toBeDefined();
      expect(logChunk!.content).toContain('abc1234');
      expect(logChunk!.content).toContain('feat: add feature');
      expect(logChunk!.content).toContain('Alice');
      expect(logChunk!.content).toContain('def7654');
      expect(logChunk!.priority).toBe(40);
    });

    it('should return null when log is empty', async () => {
      setupGitExtension({ log: [] });
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'git-log')).toBe(false);
    });
  });

  describe('built-in: dependencies', () => {
    it('should return null when no workspace folder', async () => {
      (vscode.workspace as any).workspaceFolders = undefined;
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'dependencies')).toBe(false);
    });

    it('should parse package.json and list dependencies', async () => {
      setupWorkspaceFolder();
      const pkg = JSON.stringify({
        dependencies: { express: '^4.18.0', lodash: '^4.17.0' },
        devDependencies: { vitest: '^1.0.0' },
      });
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode(pkg) as any
      );
      registry.invalidate();

      const chunks = await registry.gather();
      const depChunk = chunks.find(c => c.type === 'dependencies');
      expect(depChunk).toBeDefined();
      expect(depChunk!.content).toContain('express');
      expect(depChunk!.content).toContain('lodash');
      expect(depChunk!.content).toContain('vitest');
      expect(depChunk!.content).toContain('DevDependencies');
      expect(depChunk!.priority).toBe(45);
    });

    it('should return null when package.json has no deps', async () => {
      setupWorkspaceFolder();
      const pkg = JSON.stringify({ name: 'empty-project' });
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode(pkg) as any
      );
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'dependencies')).toBe(false);
    });

    it('should return null when package.json is missing', async () => {
      setupWorkspaceFolder();
      vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(new Error('ENOENT'));
      registry.invalidate();

      const chunks = await registry.gather();
      expect(chunks.some(c => c.type === 'dependencies')).toBe(false);
    });
  });

  // ─── gather() caching ─────────────────────────

  describe('gather() caching', () => {
    it('should cache results within TTL', async () => {
      let callCount = 0;
      registry.register('counter', async () => {
        callCount++;
        return makeChunk({ label: 'Counter', content: `call-${callCount}` });
      });

      await registry.gather();
      const first = callCount;

      await registry.gather();
      expect(callCount).toBe(first); // provider not called again
    });

    it('should refresh cache after invalidate()', async () => {
      let callCount = 0;
      registry.register('counter', async () => {
        callCount++;
        return makeChunk({ label: 'Counter' });
      });

      await registry.gather();
      expect(callCount).toBe(1);

      registry.invalidate();
      await registry.gather();
      expect(callCount).toBe(2);
    });
  });
});
