import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnippetLibrary } from '../snippets/snippet-library';

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

describe('SnippetLibrary', () => {
  let snippets: SnippetLibrary;
  let memento: any;

  beforeEach(() => {
    memento = createMockMemento();
    snippets = new SnippetLibrary(memento);
  });

  it('should start empty', () => {
    expect(snippets.list()).toHaveLength(0);
  });

  it('should save a snippet', () => {
    const s = snippets.save({
      title: 'Sort function',
      content: 'const sort = (arr) => arr.sort();',
      language: 'typescript',
      agentId: 'code',
      prompt: 'create a sort function',
      tags: ['sort', 'utility'],
    });

    expect(s.id).toBeDefined();
    expect(s.title).toBe('Sort function');
    expect(snippets.list()).toHaveLength(1);
  });

  it('should delete a snippet', () => {
    const s = snippets.save({
      title: 'To delete',
      content: 'x',
      language: 'typescript',
      agentId: 'code',
      prompt: 'test',
      tags: [],
    });

    const deleted = snippets.delete(s.id);
    expect(deleted).toBe(true);
    expect(snippets.list()).toHaveLength(0);
  });

  it('should search by keyword', () => {
    snippets.save({ title: 'React hook', content: 'useEffect(() => {}, [])', language: 'tsx', agentId: 'code', prompt: 'react hook', tags: ['react'] });
    snippets.save({ title: 'Express route', content: 'app.get("/")', language: 'typescript', agentId: 'api', prompt: 'express', tags: ['express'] });

    const results = snippets.search('react');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('React hook');
  });

  it('should toggle favorite', () => {
    const s = snippets.save({ title: 'Fav', content: 'x', language: 'ts', agentId: 'code', prompt: 'fav', tags: [] });
    expect(s.favorite).toBe(false);

    snippets.toggleFavorite(s.id);
    const found = snippets.list().find(sn => sn.id === s.id);
    expect(found?.favorite).toBe(true);

    snippets.toggleFavorite(s.id);
    const found2 = snippets.list().find(sn => sn.id === s.id);
    expect(found2?.favorite).toBe(false);
  });

  it('should persist via memento', () => {
    snippets.save({ title: 'Persist', content: 'y', language: 'ts', agentId: 'code', prompt: 'persist', tags: [] });
    expect(memento.update).toHaveBeenCalled();
  });
});
