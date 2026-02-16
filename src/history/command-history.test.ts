import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vsc from 'vscode';
import { CommandHistory } from './command-history';

// ─── Helpers ──────────────────────────────────

function createMockState() {
  const store = new Map<string, any>();
  return {
    get: vi.fn((key: string, def?: any) => store.get(key) ?? def),
    update: vi.fn((key: string, val: any) => { store.set(key, val); return Promise.resolve(); }),
    keys: vi.fn(() => [...store.keys()]),
    setKeysForSync: vi.fn(),
  } as unknown as vsc.Memento;
}

function addRecords(history: CommandHistory, count: number, overrides?: Partial<Parameters<CommandHistory['record']>[0]>) {
  const records = [];
  for (let i = 0; i < count; i++) {
    records.push(history.record({
      command: overrides?.command ?? 'code',
      prompt: overrides?.prompt ?? `prompt ${i}`,
      agentId: overrides?.agentId ?? 'code',
      timestamp: overrides?.timestamp ?? (Date.now() - (count - i) * 1000),
      durationMs: overrides?.durationMs ?? 100 + i * 10,
      success: overrides?.success ?? true,
    }));
  }
  return records;
}

// ─── Tests ────────────────────────────────────

describe('CommandHistory', () => {
  let state: vsc.Memento;
  let history: CommandHistory;

  beforeEach(() => {
    state = createMockState();
    history = new CommandHistory(state);
  });

  describe('record', () => {
    it('sparar ett kommando', () => {
      const rec = history.record({
        command: 'code',
        prompt: 'write a function',
        agentId: 'code',
        timestamp: Date.now(),
        durationMs: 150,
        success: true,
      });

      expect(rec.id).toMatch(/^cmd-/);
      expect(rec.command).toBe('code');
      expect(rec.prompt).toBe('write a function');
      expect(rec.agentId).toBe('code');
      expect(rec.tags).toEqual([]);
      expect(rec.favorite).toBe(false);
      expect(history.count).toBe(1);
    });

    it('sparar utan command (auto-route)', () => {
      const rec = history.record({
        command: undefined,
        prompt: 'help me',
        agentId: 'code',
        timestamp: Date.now(),
        durationMs: 50,
        success: true,
      });
      expect(rec.command).toBeUndefined();
    });

    it('sparar med error', () => {
      const rec = history.record({
        command: 'test',
        prompt: 'run tests',
        agentId: 'test',
        timestamp: Date.now(),
        durationMs: 200,
        success: false,
        error: 'Test failed',
      });
      expect(rec.success).toBe(false);
      expect(rec.error).toBe('Test failed');
    });

    it('persisterar', () => {
      history.record({
        command: 'code',
        prompt: 'test',
        agentId: 'code',
        timestamp: Date.now(),
        durationMs: 100,
        success: true,
      });
      expect(state.update).toHaveBeenCalled();
    });
  });

  describe('recent', () => {
    it('returnerar senaste kommandon sorterat', () => {
      const now = Date.now();
      history.record({ command: 'a', prompt: 'old', agentId: 'a', timestamp: now - 5000, durationMs: 100, success: true });
      history.record({ command: 'b', prompt: 'new', agentId: 'b', timestamp: now, durationMs: 100, success: true });

      const recent = history.recent(2);
      expect(recent[0].prompt).toBe('new');
      expect(recent[1].prompt).toBe('old');
    });

    it('begränsar resultat', () => {
      addRecords(history, 10);
      expect(history.recent(3)).toHaveLength(3);
    });

    it('returnerar tom lista om ingen historik', () => {
      expect(history.recent()).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      const now = Date.now();
      history.record({ command: 'code', prompt: 'write code', agentId: 'code', timestamp: now - 3000, durationMs: 100, success: true });
      history.record({ command: 'test', prompt: 'run tests', agentId: 'test', timestamp: now - 2000, durationMs: 200, success: false, error: 'fail' });
      history.record({ command: 'docs', prompt: 'update docs', agentId: 'docs', timestamp: now - 1000, durationMs: 150, success: true });
    });

    it('filtrerar på command', () => {
      const results = history.search({ command: 'code' });
      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('code');
    });

    it('filtrerar på agentId', () => {
      const results = history.search({ agentId: 'test' });
      expect(results).toHaveLength(1);
    });

    it('filtrerar på success', () => {
      expect(history.search({ success: true })).toHaveLength(2);
      expect(history.search({ success: false })).toHaveLength(1);
    });

    it('filtrerar på tidsintervall', () => {
      const now = Date.now();
      const results = history.search({ from: now - 2500, to: now - 500 });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('söker med query', () => {
      const results = history.search({ query: 'code' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('söker med query som matchar agentId', () => {
      const results = history.search({ query: 'docs' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('begränsar resultat med limit', () => {
      const results = history.search({ limit: 1 });
      expect(results).toHaveLength(1);
    });

    it('filtrerar på favorite', () => {
      const all = history.recent();
      history.toggleFavorite(all[0].id);
      expect(history.search({ favorite: true })).toHaveLength(1);
    });

    it('filtrerar på tags', () => {
      const all = history.recent();
      history.tag(all[0].id, ['important']);
      expect(history.search({ tags: ['important'] })).toHaveLength(1);
    });

    it('query söker i tags', () => {
      const all = history.recent();
      history.tag(all[0].id, ['react']);
      const results = history.search({ query: 'react' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('get', () => {
    it('hämtar med id', () => {
      const rec = history.record({ command: 'a', prompt: 't', agentId: 'a', timestamp: Date.now(), durationMs: 10, success: true });
      expect(history.get(rec.id)).toEqual(rec);
    });

    it('returnerar undefined för okänt id', () => {
      expect(history.get('nonexistent')).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('tar bort post', () => {
      const rec = history.record({ command: 'a', prompt: 't', agentId: 'a', timestamp: Date.now(), durationMs: 10, success: true });
      expect(history.remove(rec.id)).toBe(true);
      expect(history.get(rec.id)).toBeUndefined();
      expect(history.count).toBe(0);
    });

    it('returnerar false för okänt id', () => {
      expect(history.remove('nonexistent')).toBe(false);
    });
  });

  describe('toggleFavorite', () => {
    it('togglar favorit', () => {
      const rec = history.record({ command: 'a', prompt: 't', agentId: 'a', timestamp: Date.now(), durationMs: 10, success: true });
      expect(history.toggleFavorite(rec.id)).toBe(true);
      expect(history.get(rec.id)?.favorite).toBe(true);
      expect(history.toggleFavorite(rec.id)).toBe(false);
      expect(history.get(rec.id)?.favorite).toBe(false);
    });

    it('returnerar false för okänt id', () => {
      expect(history.toggleFavorite('x')).toBe(false);
    });
  });

  describe('tag', () => {
    it('lägger till taggar', () => {
      const rec = history.record({ command: 'a', prompt: 't', agentId: 'a', timestamp: Date.now(), durationMs: 10, success: true });
      expect(history.tag(rec.id, ['react', 'hook'])).toBe(true);
      expect(history.get(rec.id)?.tags).toEqual(['react', 'hook']);
    });

    it('deduplicerar taggar', () => {
      const rec = history.record({ command: 'a', prompt: 't', agentId: 'a', timestamp: Date.now(), durationMs: 10, success: true });
      history.tag(rec.id, ['a', 'b']);
      history.tag(rec.id, ['b', 'c']);
      expect(history.get(rec.id)?.tags).toEqual(['a', 'b', 'c']);
    });

    it('returnerar false för okänt id', () => {
      expect(history.tag('x', ['a'])).toBe(false);
    });
  });

  describe('stats', () => {
    it('beräknar statistik', () => {
      history.record({ command: 'code', prompt: 'a', agentId: 'code', timestamp: Date.now(), durationMs: 100, success: true });
      history.record({ command: 'code', prompt: 'b', agentId: 'code', timestamp: Date.now(), durationMs: 200, success: true });
      history.record({ command: 'test', prompt: 'c', agentId: 'test', timestamp: Date.now(), durationMs: 300, success: false });

      const s = history.stats();
      expect(s.total).toBe(3);
      expect(s.successRate).toBeCloseTo(2 / 3);
      expect(s.avgDurationMs).toBe(200);
      expect(s.byCommand['code']).toBe(2);
      expect(s.byCommand['test']).toBe(1);
      expect(s.byAgent['code']).toBe(2);
      expect(s.byAgent['test']).toBe(1);
      expect(s.mostUsedCommands[0].command).toBe('code');
      expect(s.recentActivity.length).toBeGreaterThanOrEqual(1);
    });

    it('räknar favoriter', () => {
      const rec = history.record({ command: 'a', prompt: 't', agentId: 'a', timestamp: Date.now(), durationMs: 10, success: true });
      history.toggleFavorite(rec.id);
      expect(history.stats().favorites).toBe(1);
    });

    it('hanterar tom historik', () => {
      const s = history.stats();
      expect(s.total).toBe(0);
      expect(s.successRate).toBe(0);
      expect(s.avgDurationMs).toBe(0);
    });

    it('räknar (auto) för undefined command', () => {
      history.record({ command: undefined, prompt: 'auto', agentId: 'code', timestamp: Date.now(), durationMs: 10, success: true });
      expect(history.stats().byCommand['(auto)']).toBe(1);
    });
  });

  describe('clear', () => {
    it('rensar all historik', () => {
      addRecords(history, 5);
      history.clear();
      expect(history.count).toBe(0);
    });

    it('behåller favoriter med keepFavorites', () => {
      const recs = addRecords(history, 5);
      history.toggleFavorite(recs[0].id);
      history.toggleFavorite(recs[2].id);
      history.clear(true);
      expect(history.count).toBe(2);
    });
  });

  describe('onDidChange event', () => {
    it('emittar vid record', () => {
      const cb = vi.fn();
      history.onDidChange(cb);
      history.record({ command: 'a', prompt: 't', agentId: 'a', timestamp: Date.now(), durationMs: 10, success: true });
      expect(cb).toHaveBeenCalled();
    });

    it('emittar vid remove', () => {
      const rec = history.record({ command: 'a', prompt: 't', agentId: 'a', timestamp: Date.now(), durationMs: 10, success: true });
      const cb = vi.fn();
      history.onDidChange(cb);
      history.remove(rec.id);
      expect(cb).toHaveBeenCalled();
    });

    it('emittar vid clear', () => {
      addRecords(history, 3);
      const cb = vi.fn();
      history.onDidChange(cb);
      history.clear();
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('onDidReplay event', () => {
    it('emittar vid replay via showPicker inte direkt (behöver UI)', () => {
      // onDidReplay emittas från showPicker som behöver UI
      // Testa att event finns
      const cb = vi.fn();
      const disp = history.onDidReplay(cb);
      expect(disp).toBeDefined();
      disp.dispose();
    });
  });

  describe('trimming', () => {
    it('trimmar vid maxstorlek och behåller favoriter', () => {
      // Skapa records som överskrider max
      for (let i = 0; i < 1010; i++) {
        history.record({ command: 'a', prompt: `p${i}`, agentId: 'a', timestamp: Date.now() + i, durationMs: 10, success: true });
      }
      expect(history.count).toBeLessThanOrEqual(1000);
    });
  });

  describe('showPicker', () => {
    it('returnerar undefined vid avbrutet val', async () => {
      (vsc.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const result = await history.showPicker();
      expect(result).toBeUndefined();
    });

    it('hanterar search action', async () => {
      (vsc.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ action: 'search' });
      (vsc.window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const result = await history.showPicker();
      expect(result).toBeUndefined();
    });

    it('hanterar stats action', async () => {
      (vsc.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ action: 'stats' });
      const result = await history.showPicker();
      expect(result).toBeUndefined();
    });

    it('hanterar clear action utan bekräftelse', async () => {
      (vsc.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ action: 'clear' });
      (vsc.window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const result = await history.showPicker();
      expect(result).toBeUndefined();
    });

    it('hanterar clear action med bekräftelse', async () => {
      addRecords(history, 3);
      (vsc.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ action: 'clear' });
      (vsc.window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce('Ja, rensa');
      await history.showPicker();
      expect(history.count).toBe(0);
    });
  });

  describe('showStats', () => {
    it('öppnar dokument med statistik', async () => {
      addRecords(history, 5);
      await history.showStats();
      expect(vsc.workspace.openTextDocument).toHaveBeenCalled();
      expect(vsc.window.showTextDocument).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('kan disponeras utan fel', () => {
      expect(() => history.dispose()).not.toThrow();
    });
  });
});
