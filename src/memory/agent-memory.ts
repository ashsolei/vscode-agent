import * as vscode from 'vscode';

/**
 * Ett enskilt minne som agenten har sparat.
 */
export interface Memory {
  id: string;
  agentId: string;
  type: 'fact' | 'preference' | 'decision' | 'context' | 'error';
  content: string;
  tags: string[];
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

/**
 * AgentMemory — persistent minneshantering för agenter.
 *
 * Ger agenter möjlighet att:
 * - Spara "minnen" mellan sessioner (via globalState)
 * - Söka och hämta relevanta minnen baserat på tags och nyckelord
 * - Bygga kontextfönster av relevanta minnen för LLM-prompts
 * - Automatiskt glömma gamla/oanvända minnen
 */
export class AgentMemory {
  private static readonly STORAGE_KEY = 'agentMemories';
  private memories: Memory[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;

  constructor(private globalState: vscode.Memento) {
    this.load();
  }

  // ─────────────────────────────────────────────────────
  //  CRUD
  // ─────────────────────────────────────────────────────

  /**
   * Spara ett nytt minne.
   */
  remember(
    agentId: string,
    content: string,
    options?: {
      type?: Memory['type'];
      tags?: string[];
    }
  ): Memory {
    const memory: Memory = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      type: options?.type ?? 'fact',
      content,
      tags: options?.tags ?? [],
      createdAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now(),
    };

    this.memories.push(memory);
    this.persist();
    return memory;
  }

  /**
   * Glöm ett specifikt minne.
   */
  forget(id: string): boolean {
    const before = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    if (this.memories.length < before) {
      this.persist();
      return true;
    }
    return false;
  }

  /**
   * Glöm alla minnen för en specifik agent.
   */
  forgetAll(agentId: string): number {
    const before = this.memories.length;
    this.memories = this.memories.filter((m) => m.agentId !== agentId);
    this.persist();
    return before - this.memories.length;
  }

  // ─────────────────────────────────────────────────────
  //  Sökning och recall
  // ─────────────────────────────────────────────────────

  /**
   * Hämta alla minnen för en agent.
   */
  recall(agentId: string): Memory[] {
    const mems = this.memories.filter((m) => m.agentId === agentId);
    for (const m of mems) {
      m.accessCount++;
      m.lastAccessedAt = Date.now();
    }
    this.debouncedPersist();
    return mems;
  }

  /**
   * Sök minnen baserat på nyckelord (fuzzy).
   */
  search(query: string, options?: { agentId?: string; limit?: number }): Memory[] {
    const words = query.toLowerCase().split(/\s+/);
    const limit = options?.limit ?? 10;

    const candidates = options?.agentId
      ? this.memories.filter((m) => m.agentId === options.agentId)
      : [...this.memories];

    // Rankningen: antal matchade ord i content + tags
    const scored = candidates.map((m) => {
      const haystack = `${m.content} ${m.tags.join(' ')}`.toLowerCase();
      const score = words.reduce((s, w) => (haystack.includes(w) ? s + 1 : s), 0);
      return { memory: m, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => {
        s.memory.accessCount++;
        s.memory.lastAccessedAt = Date.now();
        return s.memory;
      });
  }

  /**
   * Sök minnen baserat på tags.
   */
  findByTags(tags: string[], agentId?: string): Memory[] {
    return this.memories.filter((m) => {
      if (agentId && m.agentId !== agentId) { return false; }
      return tags.some((t) => m.tags.includes(t));
    });
  }

  /**
   * Bygg ett "kontextfönster" — en textsammanställning av relevanta minnen
   * som kan injiceras i LLM-prompter.
   */
  buildContextWindow(
    agentId: string,
    query?: string,
    maxTokensApprox = 1000
  ): string {
    let relevant: Memory[];

    if (query) {
      relevant = this.search(query, { agentId, limit: 20 });
    } else {
      relevant = this.recall(agentId);
    }

    if (relevant.length === 0) {
      return '';
    }

    // Prioritera: senast använda + mest använda
    relevant.sort((a, b) => {
      const recencyA = Date.now() - a.lastAccessedAt;
      const recencyB = Date.now() - b.lastAccessedAt;
      return recencyA - recencyB || b.accessCount - a.accessCount;
    });

    let context = '--- Agent-minne ---\n';
    let approxTokens = 0;

    for (const m of relevant) {
      const line = `[${m.type}] ${m.content}\n`;
      const lineTokens = Math.ceil(line.length / 4); // grov uppskattning
      if (approxTokens + lineTokens > maxTokensApprox) { break; }
      context += line;
      approxTokens += lineTokens;
    }

    context += '--- Slut på minne ---\n';
    return context;
  }

  // ─────────────────────────────────────────────────────
  //  Underhåll
  // ─────────────────────────────────────────────────────

  /**
   * Automatisk rensning: ta bort gamla, oanvända minnen.
   */
  prune(options?: {
    maxAge?: number;         // max ålder i ms (default: 30 dagar)
    maxCount?: number;       // max antal minnen totalt (default: 500)
    minAccessCount?: number; // minnen med färre åtkomster rensas först
  }): number {
    const maxAge = options?.maxAge ?? 30 * 24 * 60 * 60 * 1000;
    const maxCount = options?.maxCount ?? 500;
    const now = Date.now();

    const before = this.memories.length;

    // Ta bort gamla
    this.memories = this.memories.filter(
      (m) => now - m.lastAccessedAt < maxAge
    );

    // Om fortfarande för många, ta bort minst använda
    if (this.memories.length > maxCount) {
      this.memories.sort((a, b) => b.accessCount - a.accessCount);
      this.memories = this.memories.slice(0, maxCount);
    }

    if (this.memories.length < before) {
      this.persist();
    }

    return before - this.memories.length;
  }

  /**
   * Hämta minnesstatistik.
   */
  stats(): {
    totalMemories: number;
    byAgent: Record<string, number>;
    byType: Record<string, number>;
    oldestMemory: number | null;
  } {
    const byAgent: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const m of this.memories) {
      byAgent[m.agentId] = (byAgent[m.agentId] ?? 0) + 1;
      byType[m.type] = (byType[m.type] ?? 0) + 1;
    }

    return {
      totalMemories: this.memories.length,
      byAgent,
      byType,
      oldestMemory: this.memories.length > 0
        ? Math.min(...this.memories.map((m) => m.createdAt))
        : null,
    };
  }

  // ─────────────────────────────────────────────────────
  //  Persistence
  // ─────────────────────────────────────────────────────

  private load(): void {
    const stored = this.globalState.get<Memory[]>(AgentMemory.STORAGE_KEY);
    if (stored) {
      this.memories = stored;
    }
  }

  /** Debounced persist — skriver max var 5:e sekund för access-count uppdateringar */
  private debouncedPersist(): void {
    this.dirty = true;
    if (this.persistTimer) { return; }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined;
      if (this.dirty) {
        this.dirty = false;
        this.persist();
      }
    }, 5000);
  }

  private persist(): void {
    this.globalState.update(AgentMemory.STORAGE_KEY, this.memories);
  }
}
