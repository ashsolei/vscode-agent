import * as vscode from 'vscode';

export interface CacheEntry<T = string> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
  agentId?: string;
  model?: string;
}

export interface CacheOptions {
  ttlMs?: number;
  maxEntries?: number;
  agentId?: string;
  model?: string;
}

const DEFAULT_TTL = 10 * 60 * 1000;   // 10 minuter
const DEFAULT_MAX = 200;

export class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private defaultTtl: number;
  private _hits = 0;
  private _misses = 0;

  constructor(
    private memento?: vscode.Memento,
    options?: { maxEntries?: number; defaultTtl?: number }
  ) {
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX;
    this.defaultTtl = options?.defaultTtl ?? DEFAULT_TTL;
    this.load();
  }

  private load() {
    if (!this.memento) {return;}
    const data = this.memento.get<[string, CacheEntry][]>('responseCache', []);
    const now = Date.now();
    for (const [key, entry] of data) {
      if (entry.expiresAt > now) {
        this.cache.set(key, entry);
      }
    }
  }

  private async persist() {
    if (!this.memento) {return;}
    await this.memento.update('responseCache', Array.from(this.cache.entries()));
  }

  /** Generera en cache-nyckel från prompt + context */
  static makeKey(prompt: string, command?: string, model?: string): string {
    const parts = [prompt.trim().toLowerCase()];
    if (command) {parts.push(`cmd:${command}`);}
    if (model) {parts.push(`model:${model}`);}
    return parts.join('|');
  }

  /** Hämta cachat svar */
  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this._misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this._misses++;
      return undefined;
    }
    entry.hits++;
    this._hits++;
    return entry.value;
  }

  /** Cacha ett svar */
  async set(key: string, value: string, options?: CacheOptions): Promise<void> {
    // Evict om fullt (LRU: ta bort äldsta med minst hits)
    if (this.cache.size >= this.maxEntries) {
      this.evict();
    }

    const ttl = options?.ttlMs ?? this.defaultTtl;
    const entry: CacheEntry = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      hits: 0,
      agentId: options?.agentId,
      model: options?.model,
    };

    this.cache.set(key, entry);
    await this.persist();
  }

  /** Invaldera en specifik nyckel */
  async invalidate(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {await this.persist();}
    return deleted;
  }

  /** Invaldera alla poster för en agent */
  async invalidateByAgent(agentId: string): Promise<number> {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.agentId === agentId) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {await this.persist();}
    return count;
  }

  /** Rensa hela cachen */
  async clear(): Promise<void> {
    this.cache.clear();
    this._hits = 0;
    this._misses = 0;
    await this.persist();
  }

  /** Rensa utgångna poster */
  async prune(): Promise<number> {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {await this.persist();}
    return count;
  }

  private evict() {
    // LRU: hitta entry med äldst createdAt och minst hits
    let oldest: string | undefined;
    let oldestScore = Infinity;
    for (const [key, entry] of this.cache) {
      const score = entry.createdAt + entry.hits * 60000;
      if (score < oldestScore) {
        oldestScore = score;
        oldest = key;
      }
    }
    if (oldest) {this.cache.delete(oldest);}
  }

  get size(): number {
    return this.cache.size;
  }

  get stats() {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      hits: this._hits,
      misses: this._misses,
      hitRate: this._hits + this._misses > 0
        ? Math.round((this._hits / (this._hits + this._misses)) * 100)
        : 0,
    };
  }

  dispose() {
    // best-effort persist
    this.persist();
  }
}
