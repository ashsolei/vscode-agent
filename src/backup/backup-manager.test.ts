import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupManager } from './backup-manager';
import type { BackupModuleName } from './backup-manager';

// ─── Helpers ────────────────────────────────────────────────────

function createMockState(initial?: Record<string, unknown>) {
  const store = new Map<string, unknown>(Object.entries(initial ?? {}));
  return {
    get: <T>(key: string, fallback?: T): T => (store.has(key) ? (store.get(key) as T) : fallback) as T,
    update: vi.fn((key: string, value: unknown) => {
      if (value === undefined) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
      return Promise.resolve();
    }),
    keys: () => [...store.keys()],
    setKeysForSync: vi.fn(),
  };
}

function seedState() {
  return createMockState({
    agentMemories: [{ id: 'm1', content: 'minne' }],
    'agent-snippets': [{ id: 's1', name: 'snippet' }],
    'agent.conversations': [{ id: 'c1', title: 'samtal' }],
    'agent.telemetry': { events: 42 },
    'agent.profiles': [{ id: 'p1', name: 'standard' }],
    'agent.commandHistory': [{ id: 'h1' }],
    'agent.promptTemplates': [{ id: 't1' }],
    'agent.marketplace.installed': ['mkt1'],
    'agent.marketplace.ratings': {},
    'agent.marketplace.community': [],
  });
}

// ─── Tests ──────────────────────────────────────────────────────

describe('BackupManager', () => {
  let mgr: BackupManager;
  let state: ReturnType<typeof createMockState>;

  beforeEach(() => {
    state = seedState();
    mgr = new BackupManager(state as any, { autoBackupOnDispose: false });
  });

  // ─── Create ───────────────────────────────────────────────────

  describe('createBackup', () => {
    it('skapar backup med alla moduler', async () => {
      const id = await mgr.createBackup('test-backup');
      expect(id).toMatch(/^bak-/);

      const list = mgr.listMetadata();
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('test-backup');
      expect(list[0].modules).toHaveLength(8);
      expect(list[0].sizeBytes).toBeGreaterThan(0);
      expect(list[0].auto).toBe(false);
    });

    it('skapar backup med valda moduler', async () => {
      const modules: BackupModuleName[] = ['memory', 'snippets'];
      const id = await mgr.createBackup('partiell', modules);
      const meta = mgr.listMetadata().find((m) => m.id === id);
      expect(meta!.modules).toEqual(['memory', 'snippets']);
    });

    it('markerar auto-backup', async () => {
      const id = await mgr.createBackup('auto', undefined, true);
      const meta = mgr.listMetadata().find((m) => m.id === id);
      expect(meta!.auto).toBe(true);
    });

    it('sparar korrekt data', async () => {
      const id = await mgr.createBackup('full');
      const bundle = mgr.getBundle(id);
      expect(bundle).toBeDefined();
      expect(bundle!.data.memory).toEqual([{ id: 'm1', content: 'minne' }]);
      expect(bundle!.data.snippets).toEqual([{ id: 's1', name: 'snippet' }]);
    });

    it('sparar multi-key moduler som objekt', async () => {
      const id = await mgr.createBackup('full');
      const bundle = mgr.getBundle(id);
      // conversations har 2 nycklar
      const convData = bundle!.data.conversations as Record<string, unknown>;
      expect(convData['agent.conversations']).toEqual([{ id: 'c1', title: 'samtal' }]);
    });
  });

  // ─── Restore ──────────────────────────────────────────────────

  describe('restoreBackup', () => {
    it('återställer alla moduler', async () => {
      const id = await mgr.createBackup('full');

      // Rensa state
      await state.update('agentMemories', []);
      expect(state.get('agentMemories')).toEqual([]);

      const ok = await mgr.restoreBackup(id);
      expect(ok).toBe(true);

      // Verifierar att update anropades med original-data
      const calls = state.update.mock.calls;
      const restoreCall = calls.find(
        ([key, val]: [string, unknown]) =>
          key === 'agentMemories' && Array.isArray(val) && val.length > 0,
      );
      expect(restoreCall).toBeDefined();
    });

    it('återställer valda moduler', async () => {
      const id = await mgr.createBackup('full');

      state.update.mockClear();
      const ok = await mgr.restoreBackup(id, ['memory']);
      expect(ok).toBe(true);

      // Bara memory-nyckeln ska vara uppdaterad
      const updatedKeys = state.update.mock.calls.map(([k]: [string, unknown]) => k);
      expect(updatedKeys).toContain('agentMemories');
      expect(updatedKeys).not.toContain('agent-snippets');
    });

    it('returnerar false för okänd backup', async () => {
      expect(await mgr.restoreBackup('nonexistent')).toBe(false);
    });
  });

  // ─── List & Get ───────────────────────────────────────────────

  describe('listMetadata & getBundle', () => {
    it('listar alla backups', async () => {
      await mgr.createBackup('ett');
      await mgr.createBackup('två');
      expect(mgr.listMetadata()).toHaveLength(2);
    });

    it('getBundle returnerar undefined för okänt id', () => {
      expect(mgr.getBundle('does-not-exist')).toBeUndefined();
    });
  });

  // ─── Delete ───────────────────────────────────────────────────

  describe('deleteBackup', () => {
    it('tar bort backup', async () => {
      const id = await mgr.createBackup('temp');
      expect(await mgr.deleteBackup(id)).toBe(true);
      expect(mgr.listMetadata()).toHaveLength(0);
      expect(mgr.getBundle(id)).toBeUndefined();
    });

    it('returnerar false för okänt id', async () => {
      expect(await mgr.deleteBackup('nope')).toBe(false);
    });
  });

  describe('deleteAll', () => {
    it('tar bort alla backups', async () => {
      await mgr.createBackup('a');
      await mgr.createBackup('b');
      const count = await mgr.deleteAll();
      expect(count).toBe(2);
      expect(mgr.listMetadata()).toHaveLength(0);
    });
  });

  // ─── Prune ────────────────────────────────────────────────────

  describe('pruning', () => {
    it('rensar äldsta auto-backups', async () => {
      const smallMgr = new BackupManager(state as any, {
        maxBackups: 3,
        autoBackupOnDispose: false,
      });

      await smallMgr.createBackup('auto1', undefined, true);
      await smallMgr.createBackup('auto2', undefined, true);
      await smallMgr.createBackup('manual1', undefined, false);
      await smallMgr.createBackup('auto3', undefined, true);

      const list = smallMgr.listMetadata();
      // Ska ha max 3, äldsta auto borta
      expect(list.length).toBeLessThanOrEqual(3);

      const labels = list.map((m) => m.label);
      expect(labels).not.toContain('auto1');
    });

    it('behåller manuella backups vid prune', async () => {
      const smallMgr = new BackupManager(state as any, {
        maxBackups: 2,
        autoBackupOnDispose: false,
      });

      await smallMgr.createBackup('manual1', undefined, false);
      await smallMgr.createBackup('manual2', undefined, false);
      await smallMgr.createBackup('auto1', undefined, true);

      const list = smallMgr.listMetadata();
      const manuals = list.filter((m) => !m.auto);
      // Manuella ska vara kvar
      expect(manuals.length).toBe(2);
    });
  });

  // ─── Export / Import ──────────────────────────────────────────

  describe('export / import', () => {
    it('exporterar backup som JSON', async () => {
      const id = await mgr.createBackup('export-test');
      const json = mgr.exportBackup(id);
      expect(json).toBeDefined();
      const parsed = JSON.parse(json!);
      expect(parsed.meta.label).toBe('export-test');
      expect(parsed.data.memory).toBeDefined();
    });

    it('export returnerar undefined för okänt id', () => {
      expect(mgr.exportBackup('nonexistent')).toBeUndefined();
    });

    it('importerar backup', async () => {
      const id = await mgr.createBackup('original');
      const json = mgr.exportBackup(id)!;

      const newId = await mgr.importBackup(json);
      expect(newId).toBeDefined();
      expect(newId).toMatch(/^bak-imp-/);

      const bundle = mgr.getBundle(newId!);
      expect(bundle!.meta.label).toContain('Importerad');
    });

    it('import returnerar undefined vid ogiltig JSON', async () => {
      expect(await mgr.importBackup('invalid json{')).toBeUndefined();
    });

    it('import returnerar undefined vid saknad meta/data', async () => {
      expect(await mgr.importBackup('{}')).toBeUndefined();
    });
  });

  // ─── UI ───────────────────────────────────────────────────────

  describe('showRestorePicker', () => {
    it('visar info om inga backups finns', async () => {
      const showInfo = vi.spyOn(
        (await import('vscode')).window,
        'showInformationMessage',
      );
      (showInfo as any).mockResolvedValue(undefined);

      const result = await mgr.showRestorePicker();
      expect(result).toBeUndefined();
      expect(showInfo).toHaveBeenCalledOnce();
    });

    it('visar QuickPick med backups', async () => {
      await mgr.createBackup('en backup');

      const showPick = vi.spyOn(
        (await import('vscode')).window,
        'showQuickPick',
      );
      (showPick as any).mockResolvedValue(undefined);

      await mgr.showRestorePicker();
      expect(showPick).toHaveBeenCalledOnce();
    });
  });

  describe('showModulePicker', () => {
    it('visar multi-select QuickPick', async () => {
      const showPick = vi.spyOn(
        (await import('vscode')).window,
        'showQuickPick',
      );
      (showPick as any).mockResolvedValue([{ label: 'memory' }, { label: 'snippets' }]);

      const result = await mgr.showModulePicker();
      expect(result).toEqual(['memory', 'snippets']);
    });

    it('returnerar undefined om inget valt', async () => {
      const showPick = vi.spyOn(
        (await import('vscode')).window,
        'showQuickPick',
      );
      (showPick as any).mockResolvedValue(undefined);

      const result = await mgr.showModulePicker();
      expect(result).toBeUndefined();
    });
  });

  describe('showBackupSummary', () => {
    it('visar sammanfattning', async () => {
      await mgr.createBackup('s1', undefined, false);
      await mgr.createBackup('s2', undefined, true);

      const showInfo = vi.spyOn(
        (await import('vscode')).window,
        'showInformationMessage',
      );
      showInfo.mockReset();
      (showInfo as any).mockResolvedValue(undefined);

      mgr.showBackupSummary();
      expect(showInfo).toHaveBeenCalledOnce();
      const msg = showInfo.mock.calls[0][0] as string;
      expect(msg).toContain('2');
      expect(msg).toContain('1 manuella');
      expect(msg).toContain('1 auto');
    });
  });

  // ─── Dispose ──────────────────────────────────────────────────

  describe('dispose', () => {
    it('skapar auto-backup om aktiverat', async () => {
      const autoMgr = new BackupManager(state as any, { autoBackupOnDispose: true });
      await autoMgr.dispose();
      const list = autoMgr.listMetadata();
      expect(list).toHaveLength(1);
      expect(list[0].auto).toBe(true);
    });

    it('skapar ingen auto-backup om avaktiverat', async () => {
      await mgr.dispose();
      expect(mgr.listMetadata()).toHaveLength(0);
    });
  });
});
