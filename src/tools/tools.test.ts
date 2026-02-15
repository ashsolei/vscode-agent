import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from './index';
import { FileTool } from './file-tool';
import { SearchTool } from './search-tool';
import { workspace, Uri, CancellationTokenSource, FileType } from 'vscode';

// --- Helpers ---

function makeToken() {
  return new CancellationTokenSource().token;
}

// --- ToolRegistry ---

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should start empty', () => {
    expect(registry.list()).toHaveLength(0);
  });

  it('should register and retrieve a tool', () => {
    const tool = new FileTool();
    registry.register(tool);
    expect(registry.get('file')).toBe(tool);
    expect(registry.list()).toHaveLength(1);
  });

  it('should return undefined for unknown tool', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should execute a registered tool', async () => {
    const tool = new FileTool();
    registry.register(tool);

    // Mock workspace
    (workspace as any).workspaceFolders = [{ uri: Uri.file('/test') }];
    (workspace.fs.readFile as any).mockResolvedValueOnce(Buffer.from('hello'));

    const result = await registry.execute('file', { action: 'read', path: 'test.ts' }, makeToken());
    expect(result.success).toBe(true);
    expect(result.data).toBe('hello');
  });

  it('should return error for unknown tool execution', async () => {
    const result = await registry.execute('nonexistent', {}, makeToken());
    expect(result.success).toBe(false);
    expect(result.error).toContain('nonexistent');
  });

  it('should create default registry with file and search tools', () => {
    const defaultReg = ToolRegistry.createDefault();
    expect(defaultReg.get('file')).toBeInstanceOf(FileTool);
    expect(defaultReg.get('search')).toBeInstanceOf(SearchTool);
    expect(defaultReg.list()).toHaveLength(2);
  });
});

// --- FileTool ---

describe('FileTool', () => {
  let tool: FileTool;

  beforeEach(() => {
    tool = new FileTool();
    vi.clearAllMocks();
    (workspace as any).workspaceFolders = [{ uri: Uri.file('/workspace') }];
  });

  it('should read a file successfully', async () => {
    (workspace.fs.readFile as any).mockResolvedValueOnce(Buffer.from('file content'));

    const result = await tool.execute({ action: 'read', path: 'src/app.ts' }, makeToken());
    expect(result.success).toBe(true);
    expect(result.data).toBe('file content');
  });

  it('should return error when reading fails', async () => {
    (workspace.fs.readFile as any).mockRejectedValueOnce(new Error('not found'));

    const result = await tool.execute({ action: 'read', path: 'missing.ts' }, makeToken());
    expect(result.success).toBe(false);
    expect(result.error).toContain('missing.ts');
  });

  it('should return error when no workspace is open for read', async () => {
    (workspace as any).workspaceFolders = undefined;

    const result = await tool.execute({ action: 'read', path: 'test.ts' }, makeToken());
    expect(result.success).toBe(false);
  });

  it('should search for files by glob', async () => {
    const mockFiles = [Uri.file('/workspace/a.ts'), Uri.file('/workspace/b.ts')];
    (workspace as any).findFiles = vi.fn().mockResolvedValueOnce(mockFiles);

    const result = await tool.execute({ action: 'search', pattern: '**/*.ts' }, makeToken());
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should list directory entries', async () => {
    (workspace.fs.readDirectory as any).mockResolvedValueOnce([
      ['file.ts', 1],  // FileType.File = 1
      ['src', 2],      // FileType.Directory = 2
    ]);

    const result = await tool.execute({ action: 'list', directory: '' }, makeToken());
    expect(result.success).toBe(true);
    const data = result.data as Array<{ name: string; type: string }>;
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('file.ts');
    expect(data[1].type).toBe('directory');
  });

  it('should return error for unknown action', async () => {
    const result = await tool.execute({ action: 'unknown' }, makeToken());
    expect(result.success).toBe(false);
    expect(result.error).toContain('unknown');
  });
});

// --- SearchTool ---

describe('SearchTool', () => {
  let tool: SearchTool;

  beforeEach(() => {
    tool = new SearchTool();
    vi.clearAllMocks();
    (workspace as any).workspaceFolders = [{ uri: Uri.file('/workspace') }];
    (workspace as any).asRelativePath = vi.fn((uri: any) => uri.fsPath ?? uri.path ?? String(uri));
    (workspace as any).findFiles = vi.fn().mockResolvedValue([]);
  });

  it('should return error when query is missing', async () => {
    const result = await tool.execute({ query: '' }, makeToken());
    expect(result.success).toBe(false);
  });

  it('should search text in files', async () => {
    const mockFile = Uri.file('/workspace/test.ts');
    (workspace as any).findFiles = vi.fn().mockResolvedValueOnce([mockFile]);
    (workspace.fs.readFile as any).mockResolvedValueOnce(
      Buffer.from('line1\nfindMe here\nline3')
    );

    const result = await tool.execute({ query: 'findme' }, makeToken());
    expect(result.success).toBe(true);
    const data = result.data as any;
    expect(data.matchCount).toBe(1);
    expect(data.results[0].line).toBe(2);
    expect(data.results[0].text).toContain('findMe here');
  });

  it('should handle empty results gracefully', async () => {
    (workspace as any).findFiles = vi.fn().mockResolvedValueOnce([]);

    const result = await tool.execute({ query: 'notfound' }, makeToken());
    expect(result.success).toBe(true);
    expect((result.data as any).matchCount).toBe(0);
  });
});
