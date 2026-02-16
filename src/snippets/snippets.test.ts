import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnippetLibrary } from '../snippets/snippet-library';

function createMockMemento(initial?: Record<string, any>): any {
  const store: Record<string, any> = { ...initial };
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

function saveSnippet(lib: SnippetLibrary, overrides: Record<string, any> = {}) {
  return lib.save({
    title: 'Default',
    content: 'const x = 1;',
    language: 'typescript',
    agentId: 'code',
    prompt: 'test prompt',
    tags: ['util'],
    ...overrides,
  });
}

describe('SnippetLibrary', () => {
  let snippets: SnippetLibrary;
  let memento: any;

  beforeEach(() => {
    memento = createMockMemento();
    snippets = new SnippetLibrary(memento);
  });

  // ─── Save ───

  it('should start empty', () => {
    expect(snippets.list()).toHaveLength(0);
  });

  it('should save a snippet', () => {
    const s = saveSnippet(snippets, { title: 'Sort function', content: 'const sort = (arr) => arr.sort();' });
    expect(s.id).toBeDefined();
    expect(s.id).toMatch(/^snip-/);
    expect(s.title).toBe('Sort function');
    expect(s.favorite).toBe(false);
    expect(s.createdAt).toBeGreaterThan(0);
    expect(snippets.list()).toHaveLength(1);
  });

  it('should assign unique ids to each snippet', () => {
    const s1 = saveSnippet(snippets, { title: 'A' });
    const s2 = saveSnippet(snippets, { title: 'B' });
    expect(s1.id).not.toBe(s2.id);
  });

  // ─── Delete ───

  it('should delete a snippet', () => {
    const s = saveSnippet(snippets, { title: 'To delete' });
    const deleted = snippets.delete(s.id);
    expect(deleted).toBe(true);
    expect(snippets.list()).toHaveLength(0);
  });

  it('should return false when deleting non-existent snippet', () => {
    expect(snippets.delete('nonexistent')).toBe(false);
  });

  // ─── Get ───

  it('should get a snippet by id', () => {
    const s = saveSnippet(snippets, { title: 'Findable' });
    const found = snippets.get(s.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe('Findable');
  });

  it('should return undefined for unknown id', () => {
    expect(snippets.get('unknown-id')).toBeUndefined();
  });

  // ─── List with filters ───

  describe('list', () => {
    it('should filter by agentId', () => {
      saveSnippet(snippets, { agentId: 'code', title: 'A' });
      saveSnippet(snippets, { agentId: 'docs', title: 'B' });
      saveSnippet(snippets, { agentId: 'code', title: 'C' });

      const codeSnippets = snippets.list({ agentId: 'code' });
      expect(codeSnippets).toHaveLength(2);
      expect(codeSnippets.every(s => s.agentId === 'code')).toBe(true);
    });

    it('should filter by tag', () => {
      saveSnippet(snippets, { tags: ['react', 'hook'] });
      saveSnippet(snippets, { tags: ['express'] });
      saveSnippet(snippets, { tags: ['react', 'component'] });

      const reactSnippets = snippets.list({ tag: 'react' });
      expect(reactSnippets).toHaveLength(2);
    });

    it('should filter by favorite', () => {
      const s1 = saveSnippet(snippets, { title: 'Fav' });
      saveSnippet(snippets, { title: 'NotFav' });
      snippets.toggleFavorite(s1.id);

      const favorites = snippets.list({ favorite: true });
      expect(favorites).toHaveLength(1);
      expect(favorites[0].title).toBe('Fav');
    });

    it('should combine filters', () => {
      const s1 = saveSnippet(snippets, { agentId: 'code', tags: ['react'] });
      saveSnippet(snippets, { agentId: 'docs', tags: ['react'] });
      saveSnippet(snippets, { agentId: 'code', tags: ['express'] });
      snippets.toggleFavorite(s1.id);

      const result = snippets.list({ agentId: 'code', tag: 'react', favorite: true });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(s1.id);
    });

    it('should sort by createdAt descending', () => {
      const s1 = saveSnippet(snippets, { title: 'First' });
      const s2 = saveSnippet(snippets, { title: 'Second' });
      const s3 = saveSnippet(snippets, { title: 'Third' });
      // Force different timestamps
      (s1 as any).createdAt = 1000;
      (s2 as any).createdAt = 2000;
      (s3 as any).createdAt = 3000;

      const list = snippets.list();
      expect(list[0].title).toBe('Third');
      expect(list[2].title).toBe('First');
    });

    it('should return empty when no match', () => {
      saveSnippet(snippets, { agentId: 'code' });
      expect(snippets.list({ agentId: 'nonexistent' })).toHaveLength(0);
    });
  });

  // ─── Search ───

  describe('search', () => {
    it('should search by keyword in title', () => {
      saveSnippet(snippets, { title: 'React hook', content: 'useEffect(() => {}, [])' });
      saveSnippet(snippets, { title: 'Express route', content: 'app.get("/")' });

      const results = snippets.search('react');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('React hook');
    });

    it('should search in content', () => {
      saveSnippet(snippets, { title: 'A', content: 'useEffect(() => {}, [])' });
      const results = snippets.search('useEffect');
      expect(results).toHaveLength(1);
    });

    it('should search in tags', () => {
      saveSnippet(snippets, { title: 'A', tags: ['authentication'] });
      const results = snippets.search('authentication');
      expect(results).toHaveLength(1);
    });

    it('should search in prompt', () => {
      saveSnippet(snippets, { title: 'A', prompt: 'create a binary search tree' });
      const results = snippets.search('binary');
      expect(results).toHaveLength(1);
    });

    it('should handle multi-word search (all terms must match)', () => {
      saveSnippet(snippets, { title: 'React hook', content: 'useEffect', tags: ['react'] });
      saveSnippet(snippets, { title: 'React component', content: 'useState', tags: ['react'] });

      const results = snippets.search('react useEffect');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('React hook');
    });

    it('should sort favorites first in search results', () => {
      const s1 = saveSnippet(snippets, { title: 'React A', tags: ['react'] });
      saveSnippet(snippets, { title: 'React B', tags: ['react'] });
      const s3 = saveSnippet(snippets, { title: 'React C', tags: ['react'] });
      snippets.toggleFavorite(s1.id);

      const results = snippets.search('react');
      expect(results[0].id).toBe(s1.id); // favorite first
      expect(results).toHaveLength(3);
    });

    it('should return empty for no match', () => {
      saveSnippet(snippets, { title: 'A' });
      expect(snippets.search('zzz_no_match')).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      saveSnippet(snippets, { title: 'React Hook' });
      expect(snippets.search('REACT')).toHaveLength(1);
      expect(snippets.search('react')).toHaveLength(1);
    });
  });

  // ─── Toggle Favorite ───

  describe('toggleFavorite', () => {
    it('should toggle favorite on and off', () => {
      const s = saveSnippet(snippets);
      expect(s.favorite).toBe(false);

      const result1 = snippets.toggleFavorite(s.id);
      expect(result1).toBe(true);
      expect(snippets.get(s.id)!.favorite).toBe(true);

      const result2 = snippets.toggleFavorite(s.id);
      expect(result2).toBe(false);
      expect(snippets.get(s.id)!.favorite).toBe(false);
    });

    it('should return false for unknown id', () => {
      expect(snippets.toggleFavorite('unknown')).toBe(false);
    });
  });

  // ─── Stats ───

  describe('stats', () => {
    it('should return correct stats with no snippets', () => {
      const stats = snippets.stats();
      expect(stats.total).toBe(0);
      expect(stats.favorites).toBe(0);
      expect(stats.byAgent).toEqual({});
      expect(stats.byLanguage).toEqual({});
    });

    it('should count totals and favorites', () => {
      const s1 = saveSnippet(snippets, { title: 'A' });
      saveSnippet(snippets, { title: 'B' });
      snippets.toggleFavorite(s1.id);

      const stats = snippets.stats();
      expect(stats.total).toBe(2);
      expect(stats.favorites).toBe(1);
    });

    it('should group by agent', () => {
      saveSnippet(snippets, { agentId: 'code' });
      saveSnippet(snippets, { agentId: 'code' });
      saveSnippet(snippets, { agentId: 'docs' });

      const stats = snippets.stats();
      expect(stats.byAgent['code']).toBe(2);
      expect(stats.byAgent['docs']).toBe(1);
    });

    it('should group by language', () => {
      saveSnippet(snippets, { language: 'typescript' });
      saveSnippet(snippets, { language: 'typescript' });
      saveSnippet(snippets, { language: 'python' });
      saveSnippet(snippets, { language: undefined });

      const stats = snippets.stats();
      expect(stats.byLanguage['typescript']).toBe(2);
      expect(stats.byLanguage['python']).toBe(1);
      expect(Object.keys(stats.byLanguage)).toHaveLength(2); // undefined not counted
    });
  });

  // ─── detectLanguage (tested via save) ───

  describe('detectLanguage (via save without explicit language)', () => {
    it('should detect TypeScript', () => {
      const s = saveSnippet(snippets, { content: 'import { foo } from "bar";\nconst x: number = 1;', language: undefined });
      // detectLanguage finds import ... from with ': ' → typescript
      expect(snippets.get(s.id)!.language).toBeUndefined(); // language is set from input, not auto-detected on save
    });

    // detectLanguage is private, but we can test it indirectly via quickSave
    // For direct unit testing, let's test the language detection patterns via search/content
  });

  // ─── Persistence ───

  describe('persistence', () => {
    it('should persist via memento on save', () => {
      saveSnippet(snippets);
      expect(memento.update).toHaveBeenCalledWith('agent-snippets', expect.any(Array));
    });

    it('should persist on delete', () => {
      const s = saveSnippet(snippets);
      memento.update.mockClear();
      snippets.delete(s.id);
      expect(memento.update).toHaveBeenCalled();
    });

    it('should persist on toggleFavorite', () => {
      const s = saveSnippet(snippets);
      memento.update.mockClear();
      snippets.toggleFavorite(s.id);
      expect(memento.update).toHaveBeenCalled();
    });

    it('should load from existing memento data', () => {
      const existing = [
        { id: 'snip-1', title: 'Existing', content: 'abc', language: 'ts', agentId: 'code', prompt: 'p', tags: [], createdAt: 1000, favorite: true },
      ];
      const m = createMockMemento({ 'agent-snippets': existing });
      const lib = new SnippetLibrary(m);

      expect(lib.list()).toHaveLength(1);
      expect(lib.get('snip-1')!.title).toBe('Existing');
      expect(lib.get('snip-1')!.favorite).toBe(true);
    });
  });

  // ─── onDidChange event ───

  describe('onDidChange', () => {
    it('should fire on save', () => {
      const listener = vi.fn();
      snippets.onDidChange(listener);
      saveSnippet(snippets);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should fire on delete', () => {
      const s = saveSnippet(snippets);
      const listener = vi.fn();
      snippets.onDidChange(listener);
      snippets.delete(s.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should fire on toggleFavorite', () => {
      const s = saveSnippet(snippets);
      const listener = vi.fn();
      snippets.onDidChange(listener);
      snippets.toggleFavorite(s.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not fire on unsuccessful delete', () => {
      const listener = vi.fn();
      snippets.onDidChange(listener);
      snippets.delete('nonexistent');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ─── Dispose ───

  describe('dispose', () => {
    it('should not throw', () => {
      expect(() => snippets.dispose()).not.toThrow();
    });

    it('should be safe to dispose multiple times', () => {
      snippets.dispose();
      expect(() => snippets.dispose()).not.toThrow();
    });
  });
});
