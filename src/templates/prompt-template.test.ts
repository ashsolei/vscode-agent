import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptTemplateEngine } from './prompt-template';
import type { TemplateVariable } from './prompt-template';

// ─── Helpers ────────────────────────────────────────────────────

function createMockState() {
  const store = new Map<string, unknown>();
  return {
    get: <T>(key: string, fallback: T): T => (store.get(key) as T) ?? fallback,
    update: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    keys: () => [...store.keys()],
    setKeysForSync: vi.fn(),
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('PromptTemplateEngine', () => {
  let engine: PromptTemplateEngine;
  let state: ReturnType<typeof createMockState>;

  beforeEach(() => {
    state = createMockState();
    engine = new PromptTemplateEngine(state as any);
  });

  // ─── Constructor & Inbyggda ───────────────────────────────────

  describe('constructor & inbyggda templates', () => {
    it('laddas utan sparade templates', () => {
      const all = engine.list();
      // Ska ha inbyggda templates
      expect(all.length).toBeGreaterThanOrEqual(5);
    });

    it('inbyggda templates har korrekta ID-prefix', () => {
      const all = engine.list();
      const builtins = all.filter((t) => t.id.startsWith('builtin-'));
      expect(builtins.length).toBe(5);
    });
  });

  // ─── Register ─────────────────────────────────────────────────

  describe('register', () => {
    it('registrerar en ny template', () => {
      const id = engine.register({
        name: 'Min template',
        template: 'Gör {{uppgift}}',
        variables: [
          { name: 'uppgift', description: 'Uppgift', required: true, type: 'string' },
        ],
        category: 'Custom',
        tags: ['test'],
      });

      expect(id).toMatch(/^tmpl-/);
      const t = engine.get(id);
      expect(t).toBeDefined();
      expect(t!.name).toBe('Min template');
    });

    it('sparar till state', () => {
      engine.register({
        name: 'Test',
        template: '{{x}}',
        variables: [],
        category: 'A',
        tags: [],
      });
      expect(state.update).toHaveBeenCalled();
    });

    it('emittar onDidChange', () => {
      const handler = vi.fn();
      engine.onDidChange(handler);
      engine.register({
        name: 'Test',
        template: '{{x}}',
        variables: [],
        category: 'A',
        tags: [],
      });
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ─── Update ───────────────────────────────────────────────────

  describe('update', () => {
    it('uppdaterar befintlig template', () => {
      const id = engine.register({
        name: 'Original',
        template: '{{a}}',
        variables: [],
        category: 'A',
        tags: [],
      });

      const ok = engine.update(id, { name: 'Uppdaterad' });
      expect(ok).toBe(true);
      expect(engine.get(id)!.name).toBe('Uppdaterad');
    });

    it('behåller id och createdAt', () => {
      const id = engine.register({
        name: 'Original',
        template: '{{a}}',
        variables: [],
        category: 'A',
        tags: [],
      });

      const before = engine.get(id)!;
      engine.update(id, { name: 'Ny' });
      const after = engine.get(id)!;

      expect(after.id).toBe(before.id);
      expect(after.createdAt).toBe(before.createdAt);
      expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
    });

    it('returnerar false för okänt id', () => {
      expect(engine.update('nonexistent', { name: 'X' })).toBe(false);
    });
  });

  // ─── Delete ───────────────────────────────────────────────────

  describe('delete', () => {
    it('tar bort template', () => {
      const id = engine.register({
        name: 'Test',
        template: '{{a}}',
        variables: [],
        category: 'A',
        tags: [],
      });
      expect(engine.delete(id)).toBe(true);
      expect(engine.get(id)).toBeUndefined();
    });

    it('returnerar false för okänt id', () => {
      expect(engine.delete('nonexistent')).toBe(false);
    });
  });

  // ─── List & Sök ──────────────────────────────────────────────

  describe('list', () => {
    it('filtrerlar efter kategori', () => {
      engine.register({
        name: 'A', template: '{{x}}', variables: [], category: 'Kodkvalitet', tags: [],
      });
      const filtered = engine.list({ category: 'Kodkvalitet' });
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered.every((t) => t.category === 'Kodkvalitet')).toBe(true);
    });

    it('filtrerar efter agentId', () => {
      const all = engine.list({ agentId: 'review' });
      // review-templates + templates utan agentId
      expect(all.length).toBeGreaterThanOrEqual(1);
    });

    it('filtrerar efter tag', () => {
      engine.register({
        name: 'Taggad', template: '{{x}}', variables: [], category: 'A', tags: ['special'],
      });
      const result = engine.list({ tag: 'special' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Taggad');
    });
  });

  describe('search', () => {
    it('hittar templates via nyckelord', () => {
      engine.register({
        name: 'Databasmigrering', template: 'Migrera {{db}}', variables: [], category: 'DB', tags: ['migration'],
      });
      const result = engine.search('databas');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Databasmigrering');
    });

    it('söker i taggar', () => {
      engine.register({
        name: 'X', template: '{{a}}', variables: [], category: 'A', tags: ['unik-tagg'],
      });
      const result = engine.search('unik-tagg');
      expect(result).toHaveLength(1);
    });

    it('returnerar tomt vid ingen träff', () => {
      expect(engine.search('xyznonexistent')).toHaveLength(0);
    });
  });

  describe('categories', () => {
    it('returnerar unika kategorier', () => {
      const cats = engine.categories();
      expect(cats.length).toBeGreaterThanOrEqual(1);
      // Inga dubbletter
      expect(new Set(cats).size).toBe(cats.length);
    });
  });

  // ─── Rendering ────────────────────────────────────────────────

  describe('render', () => {
    it('renderar template med värden', () => {
      const id = engine.register({
        name: 'Enkel',
        template: 'Hej {{namn}}, du jobbar med {{projekt}}.',
        variables: [
          { name: 'namn', description: 'Ditt namn', required: true, type: 'string' },
          { name: 'projekt', description: 'Projektnamn', required: true, type: 'string' },
        ],
        category: 'Test',
        tags: [],
      });

      const result = engine.render(id, { namn: 'Alice', projekt: 'vscode-agent' });
      expect(result.text).toBe('Hej Alice, du jobbar med vscode-agent.');
      expect(result.filledVariables).toEqual({ namn: 'Alice', projekt: 'vscode-agent' });
      expect(result.missingVariables).toHaveLength(0);
    });

    it('använder defaultValue om ej angivet', () => {
      const id = engine.register({
        name: 'Med default',
        template: 'Fokus: {{fokus}}',
        variables: [
          { name: 'fokus', description: 'Fokus', required: false, type: 'string', defaultValue: 'prestanda' },
        ],
        category: 'Test',
        tags: [],
      });

      const result = engine.render(id, {});
      expect(result.text).toBe('Fokus: prestanda');
      expect(result.filledVariables).toEqual({ fokus: 'prestanda' });
    });

    it('rapporterar saknade required-variabler', () => {
      const id = engine.register({
        name: 'Kräver',
        template: 'Fixa {{fil}} i {{modul}}',
        variables: [
          { name: 'fil', description: 'Fil', required: true, type: 'string' },
          { name: 'modul', description: 'Modul', required: true, type: 'string' },
        ],
        category: 'Test',
        tags: [],
      });

      const result = engine.render(id, { fil: 'app.ts' });
      expect(result.missingVariables).toEqual(['modul']);
      expect(result.text).toBe('Fixa app.ts i');
    });

    it('kastar fel vid okänd template', () => {
      expect(() => engine.render('nonexistent', {})).toThrow('hittades inte');
    });

    it('renderar inbyggd template', () => {
      const result = engine.render('builtin-4', { fil: 'test.ts', testtyp: 'unit' });
      expect(result.text).toContain('test.ts');
      expect(result.text).toContain('unit');
    });
  });

  describe('renderRaw', () => {
    it('renderar rå template-sträng', () => {
      const result = engine.renderRaw(
        'Hej {{x}}!',
        [{ name: 'x', description: 'X', required: true, type: 'string' }],
        { x: 'världen' }
      );
      expect(result.text).toBe('Hej världen!');
    });
  });

  // ─── extractVariables ─────────────────────────────────────────

  describe('extractVariables', () => {
    it('extraherar variabelnamn', () => {
      const vars = PromptTemplateEngine.extractVariables('Hej {{namn}}, du har {{antal}} meddelanden');
      expect(vars).toEqual(['namn', 'antal']);
    });

    it('deduplicerar variabler', () => {
      const vars = PromptTemplateEngine.extractVariables('{{a}} och {{a}} och {{b}}');
      expect(vars).toEqual(['a', 'b']);
    });

    it('returnerar tomt för text utan variabler', () => {
      expect(PromptTemplateEngine.extractVariables('Ingen variabel här')).toEqual([]);
    });
  });

  // ─── Export / Import ──────────────────────────────────────────

  describe('export / import', () => {
    it('export returnerar JSON-sträng', () => {
      engine.register({
        name: 'Exportera', template: '{{a}}', variables: [], category: 'A', tags: [],
      });
      const json = engine.export();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('Exportera');
    });

    it('import lägger till nya templates', () => {
      const data = [{
        id: 'imported-1',
        name: 'Importerad',
        template: '{{a}}',
        variables: [],
        category: 'Imp',
        tags: [],
        createdAt: 1000,
        updatedAt: 1000,
      }];
      const count = engine.import(JSON.stringify(data));
      expect(count).toBe(1);
      expect(engine.get('imported-1')).toBeDefined();
    });

    it('import hoppar över befintliga id', () => {
      const id = engine.register({
        name: 'Finns redan', template: '{{a}}', variables: [], category: 'A', tags: [],
      });

      const data = [{
        id,
        name: 'Dublett',
        template: '{{b}}',
        variables: [],
        category: 'B',
        tags: [],
        createdAt: 1000,
        updatedAt: 1000,
      }];
      const count = engine.import(JSON.stringify(data));
      expect(count).toBe(0);
      // Originalet kvar
      expect(engine.get(id)!.name).toBe('Finns redan');
    });
  });

  // ─── UI (QuickPick) ──────────────────────────────────────────

  describe('pick', () => {
    it('visar QuickPick med templates', async () => {
      const showPick = vi.spyOn(
        (await import('vscode')).window,
        'showQuickPick'
      );
      (showPick as any).mockResolvedValue(undefined);

      await engine.pick();
      expect(showPick).toHaveBeenCalledOnce();
    });
  });

  // ─── Dispose ──────────────────────────────────────────────────

  describe('dispose', () => {
    it('dispose rensar event emitter', () => {
      engine.dispose();
      // Inget fel ska kastas
    });
  });
});
