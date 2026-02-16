import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { PluginLoader, PluginDefinition } from './plugin-loader';

// Helper: skapa en giltig plugin-definition
function makePluginDef(overrides: Partial<PluginDefinition> = {}): PluginDefinition {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    description: 'En testplugin',
    systemPrompt: 'Du är en test-agent.',
    ...overrides,
  };
}

// Helper: koda JSON till Uint8Array
function encodeJson(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

describe('PluginLoader', () => {
  let loader: PluginLoader;
  let registerCallback: ReturnType<typeof vi.fn>;
  let unregisterCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    registerCallback = vi.fn();
    unregisterCallback = vi.fn();
    loader = new PluginLoader(registerCallback, unregisterCallback);
  });

  // ─── scanAndLoad ─────────────────────────────

  describe('scanAndLoad', () => {
    it('ska returnera tom array när inga plugin-filer finns', async () => {
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      const plugins = await loader.scanAndLoad();

      expect(plugins).toEqual([]);
      expect(registerCallback).not.toHaveBeenCalled();
    });

    it('ska ladda en giltig plugin-fil', async () => {
      const def = makePluginDef();
      const uri = vscode.Uri.file('/workspace/.agent-plugins/test-plugin.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(def));

      const plugins = await loader.scanAndLoad();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].id).toBe('plugin-test-plugin');
      expect(plugins[0].name).toBe('Test Plugin');
      expect(registerCallback).toHaveBeenCalledTimes(1);
    });

    it('ska ladda flera giltiga plugin-filer', async () => {
      const def1 = makePluginDef({ id: 'alpha', name: 'Alpha' });
      const def2 = makePluginDef({ id: 'beta', name: 'Beta' });
      const uri1 = vscode.Uri.file('/workspace/.agent-plugins/alpha.json');
      const uri2 = vscode.Uri.file('/workspace/.agent-plugins/beta.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri1, uri2]);
      vi.mocked(vscode.workspace.fs.readFile)
        .mockResolvedValueOnce(encodeJson(def1))
        .mockResolvedValueOnce(encodeJson(def2));

      const plugins = await loader.scanAndLoad();

      expect(plugins).toHaveLength(2);
      expect(registerCallback).toHaveBeenCalledTimes(2);
    });

    it('ska hoppa över ogiltiga plugin-definitioner (saknar id)', async () => {
      const badDef = { name: 'Bad', systemPrompt: 'prompt' }; // saknar id
      const uri = vscode.Uri.file('/workspace/.agent-plugins/bad.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(badDef));

      const plugins = await loader.scanAndLoad();

      expect(plugins).toHaveLength(0);
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('saknar obligatoriska fält')
      );
    });

    it('ska hoppa över plugin-definitioner utan name', async () => {
      const badDef = { id: 'no-name', systemPrompt: 'prompt' }; // saknar name
      const uri = vscode.Uri.file('/workspace/.agent-plugins/bad.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(badDef));

      const plugins = await loader.scanAndLoad();

      expect(plugins).toHaveLength(0);
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('ska hoppa över plugin-definitioner utan systemPrompt', async () => {
      const badDef = { id: 'no-prompt', name: 'No Prompt' }; // saknar systemPrompt
      const uri = vscode.Uri.file('/workspace/.agent-plugins/bad.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(badDef));

      const plugins = await loader.scanAndLoad();

      expect(plugins).toHaveLength(0);
    });

    it('ska hantera JSON-parsing-fel', async () => {
      const uri = vscode.Uri.file('/workspace/.agent-plugins/corrupt.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode('{ not valid json }}}')
      );

      const plugins = await loader.scanAndLoad();

      expect(plugins).toHaveLength(0);
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Kunde inte ladda plugin')
      );
    });

    it('ska hantera filläsningsfel', async () => {
      const uri = vscode.Uri.file('/workspace/.agent-plugins/missing.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(new Error('File not found'));

      const plugins = await loader.scanAndLoad();

      expect(plugins).toHaveLength(0);
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('File not found')
      );
    });
  });

  // ─── activate ────────────────────────────────

  describe('activate', () => {
    it('ska skanna plugins och starta filewatcher', async () => {
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      const plugins = await loader.activate();

      expect(plugins).toEqual([]);
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        '**/.agent-plugins/*.json'
      );
    });

    it('ska ladda existerande plugins vid aktivering', async () => {
      const def = makePluginDef();
      const uri = vscode.Uri.file('/workspace/.agent-plugins/test.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(def));

      const plugins = await loader.activate();

      expect(plugins).toHaveLength(1);
    });
  });

  // ─── Plugin-ID prefix ───────────────────────

  describe('plugin ID-prefix', () => {
    it('ska prefixa plugin-ID med "plugin-"', async () => {
      const def = makePluginDef({ id: 'my-agent' });
      const uri = vscode.Uri.file('/workspace/.agent-plugins/my-agent.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(def));

      const plugins = await loader.scanAndLoad();

      expect(plugins[0].id).toBe('plugin-my-agent');
    });
  });

  // ─── Omladdning vid dubbletter ──────────────

  describe('omladdning', () => {
    it('ska avregistrera befintlig plugin innan omladdning', async () => {
      const def = makePluginDef({ id: 'dup' });
      const uri = vscode.Uri.file('/workspace/.agent-plugins/dup.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(def));

      // Ladda första gången
      await loader.scanAndLoad();
      expect(registerCallback).toHaveBeenCalledTimes(1);

      // Ladda igen — bör avregistrera först
      await loader.scanAndLoad();
      expect(unregisterCallback).toHaveBeenCalledWith('plugin-dup');
      expect(registerCallback).toHaveBeenCalledTimes(2);
    });
  });

  // ─── listPlugins ────────────────────────────

  describe('listPlugins', () => {
    it('ska returnera tom array om inga plugins laddats', () => {
      expect(loader.listPlugins()).toEqual([]);
    });

    it('ska returnera alla laddade plugins', async () => {
      const def = makePluginDef();
      const uri = vscode.Uri.file('/workspace/.agent-plugins/test.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(def));

      await loader.scanAndLoad();

      const list = loader.listPlugins();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('plugin-test-plugin');
    });
  });

  // ─── createPlugin ───────────────────────────

  describe('createPlugin', () => {
    it('ska skapa en plugin-fil med boilerplate', async () => {
      (vscode.workspace as any).workspaceFolders = [
        { uri: vscode.Uri.file('/workspace'), name: 'test-ws', index: 0 },
      ];

      const uri = await loader.createPlugin('new-agent', 'New Agent');

      expect(uri).not.toBeNull();
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);

      const writeCall = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0];
      const written = JSON.parse(new TextDecoder().decode(writeCall[1] as Uint8Array));
      expect(written.id).toBe('new-agent');
      expect(written.name).toBe('New Agent');
      expect(written.systemPrompt).toContain('New Agent');
      expect(written.autonomous).toBe(false);
    });

    it('ska returnera null om ingen arbetsyta finns', async () => {
      (vscode.workspace as any).workspaceFolders = undefined;

      const uri = await loader.createPlugin('test', 'Test');

      expect(uri).toBeNull();
      expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
  });

  // ─── handleFileDelete (via intern logik) ────

  describe('handleFileDelete', () => {
    it('ska kunna avregistrera plugin vid filborttagning', async () => {
      // Ladda en plugin först
      const def = makePluginDef({ id: 'removable' });
      const uri = vscode.Uri.file('/workspace/.agent-plugins/removable.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(def));

      await loader.scanAndLoad();
      expect(loader.listPlugins()).toHaveLength(1);

      // Simulera filborttagning genom att anropa handleFileDelete via activate-watcher
      // Vi testar indirekt via activate, som registrerar en watcher
      // Watcher-mock returnerar callbacks via onDidDelete
      let deleteHandler: ((uri: vscode.Uri) => void) | undefined;
      const mockWatcher = {
        onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidDelete: vi.fn().mockImplementation((handler: any) => {
          deleteHandler = handler;
          return { dispose: vi.fn() };
        }),
        dispose: vi.fn(),
      };
      vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue(mockWatcher as any);
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      await loader.activate();

      // Trigger delete
      deleteHandler!(vscode.Uri.file('/workspace/.agent-plugins/removable.json'));

      expect(unregisterCallback).toHaveBeenCalledWith('plugin-removable');
      expect(loader.listPlugins()).toHaveLength(0);
    });

    // ─── v0.10.0: URI-to-plugin-ID mapping ───

    it('ska använda URI-mappning, inte filnamn, för att hitta plugin-ID vid borttagning', async () => {
      // Plugin with id different from filename
      const def = makePluginDef({ id: 'my-custom-id', name: 'Custom' });
      const uri = vscode.Uri.file('/workspace/.agent-plugins/different-filename.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(def));

      await loader.scanAndLoad();
      expect(loader.listPlugins()).toHaveLength(1);
      expect(loader.listPlugins()[0].id).toBe('plugin-my-custom-id');

      // Setup watcher
      let deleteHandler: ((uri: vscode.Uri) => void) | undefined;
      const mockWatcher = {
        onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidDelete: vi.fn().mockImplementation((handler: any) => {
          deleteHandler = handler;
          return { dispose: vi.fn() };
        }),
        dispose: vi.fn(),
      };
      vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue(mockWatcher as any);
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      await loader.activate();

      // Trigger delete with same URI (filename differs from plugin ID)
      deleteHandler!(vscode.Uri.file('/workspace/.agent-plugins/different-filename.json'));

      // Should use the URI mapping, not derive from filename
      expect(unregisterCallback).toHaveBeenCalledWith('plugin-my-custom-id');
      expect(loader.listPlugins()).toHaveLength(0);
    });
  });

  // ─── dispose ─────────────────────────────────

  describe('dispose', () => {
    it('ska disponera watchers och event emitter', async () => {
      const mockWatcher = {
        onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        dispose: vi.fn(),
      };
      vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue(mockWatcher as any);
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      await loader.activate();
      loader.dispose();

      expect(mockWatcher.dispose).toHaveBeenCalled();
    });
  });

  // ─── onDidChangePlugins event ───────────────

  describe('onDidChangePlugins', () => {
    it('ska tillhandahålla event för plugin-ändringar', () => {
      const listener = vi.fn();
      const sub = loader.onDidChangePlugins(listener);
      expect(sub).toBeDefined();
      expect(typeof sub.dispose).toBe('function');
    });
  });

  // ─── Blandning av giltiga och ogiltiga plugins ─

  describe('blandad laddning', () => {
    it('ska ladda giltiga och hoppa över ogiltiga', async () => {
      const goodDef = makePluginDef({ id: 'good', name: 'Good' });
      const badDef = { name: 'Bad' }; // saknar id och systemPrompt
      const uri1 = vscode.Uri.file('/workspace/.agent-plugins/good.json');
      const uri2 = vscode.Uri.file('/workspace/.agent-plugins/bad.json');

      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([uri1, uri2]);
      vi.mocked(vscode.workspace.fs.readFile)
        .mockResolvedValueOnce(encodeJson(goodDef))
        .mockResolvedValueOnce(encodeJson(badDef));

      const plugins = await loader.scanAndLoad();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('Good');
      expect(registerCallback).toHaveBeenCalledTimes(1);
      expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
    });
  });

  // ─── handleFileChange (create/modify) ───────

  describe('handleFileChange', () => {
    it('ska ladda om plugin och visa infomeddelande vid filändring', async () => {
      const def = makePluginDef({ id: 'hot-reload', name: 'Hot Reload' });
      const uri = vscode.Uri.file('/workspace/.agent-plugins/hot-reload.json');

      // Setup watcher to capture handlers
      let createHandler: ((uri: vscode.Uri) => void) | undefined;
      let changeHandler: ((uri: vscode.Uri) => void) | undefined;
      const mockWatcher = {
        onDidCreate: vi.fn().mockImplementation((handler: any) => {
          createHandler = handler;
          return { dispose: vi.fn() };
        }),
        onDidChange: vi.fn().mockImplementation((handler: any) => {
          changeHandler = handler;
          return { dispose: vi.fn() };
        }),
        onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        dispose: vi.fn(),
      };
      vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue(mockWatcher as any);
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      await loader.activate();

      // Now simulate a file create
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(def));
      await createHandler!(uri);

      expect(registerCallback).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Hot Reload')
      );
    });

    it('ska trigga onDidChangePlugins vid filändring', async () => {
      const def = makePluginDef({ id: 'changed', name: 'Changed' });
      const uri = vscode.Uri.file('/workspace/.agent-plugins/changed.json');

      let changeHandler: ((uri: vscode.Uri) => void) | undefined;
      const mockWatcher = {
        onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidChange: vi.fn().mockImplementation((handler: any) => {
          changeHandler = handler;
          return { dispose: vi.fn() };
        }),
        onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        dispose: vi.fn(),
      };
      vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue(mockWatcher as any);
      vi.mocked(vscode.workspace.findFiles).mockResolvedValue([]);

      const listener = vi.fn();
      loader.onDidChangePlugins(listener);

      await loader.activate();

      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(encodeJson(def));
      await changeHandler!(uri);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ─── PluginAgent: template variables ────────

  describe('PluginAgent', () => {
    it('ska exporteras så att PluginAgent kan användas externt', async () => {
      const { PluginAgent } = await import('./plugin-loader');
      expect(PluginAgent).toBeDefined();
    });
  });
});
