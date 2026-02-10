import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseCache } from '../cache/response-cache';

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: (key: string, defaultValue?: any) => store[key] ?? defaultValue,
    update: async (key: string, value: any) => { store[key] = value; },
  };
}

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache(createMockMemento(), { maxEntries: 5, defaultTtl: 60000 });
  });

  it('should start empty', () => {
    expect(cache.size).toBe(0);
  });

  it('should set and get a value', async () => {
    await cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing key', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should expire entries', async () => {
    await cache.set('expiring', 'val', { ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 5));
    expect(cache.get('expiring')).toBeUndefined();
  });

  it('should track hits and misses', async () => {
    await cache.set('k', 'v');
    cache.get('k');
    cache.get('k');
    cache.get('miss');

    const stats = cache.stats;
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(67);
  });

  it('should evict when full (LRU)', async () => {
    for (let i = 0; i < 5; i++) {
      await cache.set(`k${i}`, `v${i}`);
    }
    expect(cache.size).toBe(5);

    await cache.set('k5', 'v5');
    expect(cache.size).toBe(5); // still 5, oldest evicted
    expect(cache.get('k0')).toBeUndefined();
    expect(cache.get('k5')).toBe('v5');
  });

  it('should invalidate by key', async () => {
    await cache.set('a', '1');
    await cache.set('b', '2');

    const deleted = await cache.invalidate('a');
    expect(deleted).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
  });

  it('should invalidate by agent', async () => {
    await cache.set('a', '1', { agentId: 'code' });
    await cache.set('b', '2', { agentId: 'docs' });
    await cache.set('c', '3', { agentId: 'code' });

    const count = await cache.invalidateByAgent('code');
    expect(count).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('should clear all', async () => {
    await cache.set('a', '1');
    await cache.set('b', '2');
    await cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.stats.hits).toBe(0);
  });

  it('should prune expired entries', async () => {
    await cache.set('fresh', 'v1', { ttlMs: 60000 });
    await cache.set('stale', 'v2', { ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 5));

    const pruned = await cache.prune();
    expect(pruned).toBe(1);
    expect(cache.size).toBe(1);
  });

  it('should generate stable keys', () => {
    const k1 = ResponseCache.makeKey('Hello World', 'code', 'gpt-4');
    const k2 = ResponseCache.makeKey('hello world', 'code', 'gpt-4');
    expect(k1).toBe(k2);
  });

  it('should generate different keys for different commands', () => {
    const k1 = ResponseCache.makeKey('test', 'code');
    const k2 = ResponseCache.makeKey('test', 'docs');
    expect(k1).not.toBe(k2);
  });
});
