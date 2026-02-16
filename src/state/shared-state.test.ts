import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { SharedState } from './shared-state';

/**
 * Tester för SharedState — delat tillstånd mellan VS Code-fönster.
 * Testar get/set/delete/clear, EventEmitter, kors-fönster-synk och dispose.
 */

// ─── Mock-helpers ───

function createMockMemento(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  return {
    get: vi.fn(<T>(key: string, defaultValue?: T): T => {
      return (store[key] as T) ?? (defaultValue as T);
    }),
    update: vi.fn(async (key: string, value: unknown) => {
      store[key] = value;
    }),
    _store: store,
  };
}

function createStorageUri() {
  return vscode.Uri.file('/tmp/test-storage');
}

describe('SharedState', () => {
  let state: SharedState;
  let memento: ReturnType<typeof createMockMemento>;
  let storageUri: ReturnType<typeof createStorageUri>;

  beforeEach(() => {
    vi.clearAllMocks();
    memento = createMockMemento();
    storageUri = createStorageUri();
    state = new SharedState(memento as any, storageUri);
  });

  // ─── Grundläggande CRUD ───

  describe('get/set', () => {
    it('lagrar och hämtar ett värde', () => {
      state.set('name', 'agent-x');
      expect(state.get<string>('name')).toBe('agent-x');
    });

    it('returnerar undefined för okänd nyckel', () => {
      expect(state.get('nonexistent')).toBeUndefined();
    });

    it('skriver över befintligt värde', () => {
      state.set('key', 'first');
      state.set('key', 'second');
      expect(state.get('key')).toBe('second');
    });

    it('stöder komplexa objekt', () => {
      const obj = { nested: { items: [1, 2, 3] } };
      state.set('complex', obj);
      expect(state.get('complex')).toEqual(obj);
    });

    it('stöder numeriska värden', () => {
      state.set('count', 42);
      expect(state.get<number>('count')).toBe(42);
    });

    it('stöder boolean-värden', () => {
      state.set('active', true);
      expect(state.get<boolean>('active')).toBe(true);
    });
  });

  // ─── getAll ───

  describe('getAll', () => {
    it('returnerar tomt objekt initialt', () => {
      expect(state.getAll()).toEqual({});
    });

    it('returnerar alla lagrade värden', () => {
      state.set('a', 1);
      state.set('b', 'two');
      state.set('c', true);

      const all = state.getAll();
      expect(all).toEqual({ a: 1, b: 'two', c: true });
    });
  });

  // ─── delete ───

  describe('delete', () => {
    it('tar bort ett värde', () => {
      state.set('key', 'value');
      state.delete('key');
      expect(state.get('key')).toBeUndefined();
    });

    it('hanterar radering av icke-existerande nyckel utan fel', () => {
      expect(() => state.delete('nonexistent')).not.toThrow();
    });

    it('andra nycklar påverkas inte', () => {
      state.set('a', 1);
      state.set('b', 2);
      state.delete('a');
      expect(state.get('a')).toBeUndefined();
      expect(state.get('b')).toBe(2);
    });
  });

  // ─── clear ───

  describe('clear', () => {
    it('rensar allt tillstånd', () => {
      state.set('x', 1);
      state.set('y', 2);
      state.clear();

      expect(state.getAll()).toEqual({});
      expect(state.get('x')).toBeUndefined();
      expect(state.get('y')).toBeUndefined();
    });

    it('fungerar på redan tomt tillstånd', () => {
      expect(() => state.clear()).not.toThrow();
      expect(state.getAll()).toEqual({});
    });
  });

  // ─── Persistering till globalState ───

  describe('persistering', () => {
    it('persisterar till globalState vid set', () => {
      state.set('key', 'value');
      expect(memento.update).toHaveBeenCalledWith('sharedAgentState', { key: 'value' });
    });

    it('persisterar till globalState vid delete', () => {
      state.set('a', 1);
      state.set('b', 2);
      vi.clearAllMocks();
      state.delete('a');
      expect(memento.update).toHaveBeenCalledWith('sharedAgentState', { b: 2 });
    });

    it('persisterar vid clear', () => {
      state.set('key', 'value');
      vi.clearAllMocks();
      state.clear();
      expect(memento.update).toHaveBeenCalledWith('sharedAgentState', {});
    });
  });

  // ─── Ladda befintligt tillstånd ───

  describe('ladda befintligt tillstånd', () => {
    it('laddar state från globalState vid konstruktion', () => {
      const existingMemento = createMockMemento({
        sharedAgentState: { existing: 'data', count: 5 },
      });
      const s = new SharedState(existingMemento as any, storageUri);

      expect(s.get('existing')).toBe('data');
      expect(s.get('count')).toBe(5);
    });

    it('hanterar avsaknad av befintligt state', () => {
      const emptyMemento = createMockMemento();
      const s = new SharedState(emptyMemento as any, storageUri);
      expect(s.getAll()).toEqual({});
    });
  });

  // ─── Event (onDidChange) ───

  describe('onDidChange', () => {
    it('triggar event vid set', () => {
      const listener = vi.fn();
      state.onDidChange(listener);

      state.set('key', 'value');

      expect(listener).toHaveBeenCalledWith({ key: 'key', value: 'value' });
    });

    it('triggar event vid delete', () => {
      const listener = vi.fn();
      state.set('key', 'value');

      state.onDidChange(listener);
      state.delete('key');

      expect(listener).toHaveBeenCalledWith({ key: 'key', value: undefined });
    });

    it('triggar event för varje nyckel vid clear', () => {
      state.set('a', 1);
      state.set('b', 2);

      const listener = vi.fn();
      state.onDidChange(listener);
      state.clear();

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith({ key: 'a', value: undefined });
      expect(listener).toHaveBeenCalledWith({ key: 'b', value: undefined });
    });

    it('skickar uppdaterat värde vid överskrivning', () => {
      const listener = vi.fn();
      state.onDidChange(listener);

      state.set('key', 'first');
      state.set('key', 'second');

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith({ key: 'key', value: 'second' });
    });
  });

  // ─── windowId ───

  describe('windowId', () => {
    it('genererar ett unikt windowId', () => {
      expect(state.windowId).toBeDefined();
      expect(state.windowId.length).toBe(8);
    });

    it('varje instans får unikt id', () => {
      const state2 = new SharedState(createMockMemento() as any, storageUri);
      expect(state.windowId).not.toBe(state2.windowId);
      state2.dispose();
    });
  });

  // ─── Kors-fönster-synk ───

  describe('kors-fönster-synk', () => {
    it('sätter upp FileSystemWatcher om storageUri finns', () => {
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
    });

    it('sätter INTE upp FileSystemWatcher om storageUri saknas', () => {
      vi.clearAllMocks();
      const noStorageState = new SharedState(createMockMemento() as any, undefined);
      expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();
      noStorageState.dispose();
    });

    it('skriver sync-fil vid set om storageUri finns', () => {
      state.set('key', 'value');
      // notifyOtherWindows anropas — verifierar att writeFile anropas
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('skriver sync-fil vid delete', () => {
      state.set('key', 'val');
      vi.clearAllMocks();
      state.delete('key');
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('skriver INTE sync-fil om storageUri saknas', async () => {
      vi.clearAllMocks();
      const noStorageState = new SharedState(createMockMemento() as any, undefined);
      noStorageState.set('key', 'val');
      expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
      noStorageState.dispose();
    });

    it('reloadFromSyncFile uppdaterar cache från annat fönster', async () => {
      // Capture the watcher change handler
      let changeHandler: (() => void) | undefined;
      vi.clearAllMocks();
      vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(() => {
        const mock = {
          onDidChange: vi.fn().mockImplementation((handler: any) => {
            changeHandler = handler;
            return { dispose: vi.fn() };
          }),
          onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
          onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
          dispose: vi.fn(),
        };
        return mock as any;
      });

      const syncState = new SharedState(createMockMemento() as any, storageUri);

      // Simulate another window writing to sync file
      const otherWindowData = JSON.stringify({
        windowId: 'other-win',
        changedKey: 'fromOther',
        timestamp: Date.now(),
        state: { fromOther: 'hello', extra: 42 },
      });
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode(otherWindowData)
      );

      const listener = vi.fn();
      syncState.onDidChange(listener);

      // Trigger the watcher change
      await changeHandler!();

      expect(syncState.get('fromOther')).toBe('hello');
      expect(syncState.get('extra')).toBe(42);
      expect(listener).toHaveBeenCalledWith({ key: 'fromOther', value: 'hello' });
      syncState.dispose();
    });

    it('reloadFromSyncFile ignorerar egna ändringar', async () => {
      let changeHandler: (() => void) | undefined;
      vi.clearAllMocks();
      vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(() => ({
        onDidChange: vi.fn().mockImplementation((handler: any) => {
          changeHandler = handler;
          return { dispose: vi.fn() };
        }),
        onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        dispose: vi.fn(),
      } as any));

      const syncState = new SharedState(createMockMemento() as any, storageUri);

      // Sync file from same window — should be ignored
      const sameWindowData = JSON.stringify({
        windowId: syncState.windowId,
        changedKey: 'self',
        timestamp: Date.now(),
        state: { self: 'ignored' },
      });
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode(sameWindowData)
      );

      await changeHandler!();

      expect(syncState.get('self')).toBeUndefined();
      syncState.dispose();
    });

    it('reloadFromSyncFile hanterar läsfel utan krasch', async () => {
      let changeHandler: (() => void) | undefined;
      vi.clearAllMocks();
      vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(() => ({
        onDidChange: vi.fn().mockImplementation((handler: any) => {
          changeHandler = handler;
          return { dispose: vi.fn() };
        }),
        onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        dispose: vi.fn(),
      } as any));

      const syncState = new SharedState(createMockMemento() as any, storageUri);
      vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(new Error('File not found'));

      await expect(changeHandler!()).resolves.not.toThrow();
      syncState.dispose();
    });
  });

  // ─── Dispose ───

  describe('dispose', () => {
    it('rensar utan fel', () => {
      expect(() => state.dispose()).not.toThrow();
    });

    it('kan anropas flera gånger utan fel', () => {
      state.dispose();
      expect(() => state.dispose()).not.toThrow();
    });
  });
});
