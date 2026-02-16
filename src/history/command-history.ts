import * as vscode from 'vscode';

/**
 * En sparad kommandohistorik-post.
 */
export interface CommandRecord {
  id: string;
  /** Slash-kommandot (t.ex. "code", "refactor") */
  command: string | undefined;
  /** Användarens prompt */
  prompt: string;
  /** Agenten som hanterade kommandot */
  agentId: string;
  /** Tidpunkt */
  timestamp: number;
  /** Exekveringstid i ms */
  durationMs: number;
  /** Om kommandot lyckades */
  success: boolean;
  /** Fel-meddelande om det misslyckades */
  error?: string;
  /** Taggar för filtrering */
  tags: string[];
  /** Favorit */
  favorite: boolean;
}

/**
 * Filter för att söka i historiken.
 */
export interface HistoryFilter {
  command?: string;
  agentId?: string;
  success?: boolean;
  favorite?: boolean;
  from?: number;
  to?: number;
  query?: string;
  tags?: string[];
  limit?: number;
}

/**
 * Statistik från kommandohistoriken.
 */
export interface HistoryStats {
  total: number;
  favorites: number;
  successRate: number;
  avgDurationMs: number;
  byCommand: Record<string, number>;
  byAgent: Record<string, number>;
  mostUsedCommands: Array<{ command: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
}

/**
 * CommandHistory — sparar, söker och kan replaya tidigare kommandon.
 * Persistent via VS Code globalState.
 */
export class CommandHistory implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'agent.commandHistory';
  private static readonly MAX_ENTRIES = 1000;

  private records: CommandRecord[] = [];
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private readonly _onDidReplay = new vscode.EventEmitter<CommandRecord>();
  readonly onDidReplay = this._onDidReplay.event;

  constructor(private readonly globalState: vscode.Memento) {
    this.load();
  }

  /**
   * Logga ett nytt kommando i historiken.
   */
  record(entry: Omit<CommandRecord, 'id' | 'tags' | 'favorite'>): CommandRecord {
    const record: CommandRecord = {
      ...entry,
      id: this.generateId(),
      tags: [],
      favorite: false,
    };

    this.records.push(record);

    // Trimma till maxstorlek
    if (this.records.length > CommandHistory.MAX_ENTRIES) {
      // Behåll favoriter + senaste
      const favorites = this.records.filter((r) => r.favorite);
      const nonFavorites = this.records.filter((r) => !r.favorite);
      const keepCount = CommandHistory.MAX_ENTRIES - favorites.length;
      this.records = [...favorites, ...nonFavorites.slice(-keepCount)];
    }

    this.persist();
    this._onDidChange.fire();
    return record;
  }

  /**
   * Hämta senaste kommandon.
   */
  recent(limit = 20): CommandRecord[] {
    return [...this.records]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Sök i historiken med filter.
   */
  search(filter: HistoryFilter): CommandRecord[] {
    let results = [...this.records];

    if (filter.command) {
      results = results.filter((r) => r.command === filter.command);
    }
    if (filter.agentId) {
      results = results.filter((r) => r.agentId === filter.agentId);
    }
    if (filter.success !== undefined) {
      results = results.filter((r) => r.success === filter.success);
    }
    if (filter.favorite !== undefined) {
      results = results.filter((r) => r.favorite === filter.favorite);
    }
    if (filter.from) {
      results = results.filter((r) => r.timestamp >= filter.from!);
    }
    if (filter.to) {
      results = results.filter((r) => r.timestamp <= filter.to!);
    }
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter((r) =>
        filter.tags!.some((t) => r.tags.includes(t))
      );
    }
    if (filter.query) {
      const q = filter.query.toLowerCase();
      results = results.filter((r) =>
        r.prompt.toLowerCase().includes(q) ||
        (r.command?.toLowerCase().includes(q) ?? false) ||
        r.agentId.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Hämta ett specifikt kommando.
   */
  get(id: string): CommandRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  /**
   * Ta bort ett kommando.
   */
  remove(id: string): boolean {
    const index = this.records.findIndex((r) => r.id === id);
    if (index < 0) { return false; }
    this.records.splice(index, 1);
    this.persist();
    this._onDidChange.fire();
    return true;
  }

  /**
   * Markera som favorit.
   */
  toggleFavorite(id: string): boolean {
    const record = this.records.find((r) => r.id === id);
    if (!record) { return false; }
    record.favorite = !record.favorite;
    this.persist();
    this._onDidChange.fire();
    return record.favorite;
  }

  /**
   * Lägg till taggar.
   */
  tag(id: string, tags: string[]): boolean {
    const record = this.records.find((r) => r.id === id);
    if (!record) { return false; }
    record.tags = [...new Set([...record.tags, ...tags])];
    this.persist();
    this._onDidChange.fire();
    return true;
  }

  /**
   * Visa QuickPick för att välja och replaya ett kommando.
   * Returnerar det valda kommandot eller undefined.
   */
  async showPicker(): Promise<CommandRecord | undefined> {
    const items: (vscode.QuickPickItem & { recordId?: string; action?: string })[] = [];

    // Favoriter
    const favorites = this.search({ favorite: true, limit: 10 });
    if (favorites.length > 0) {
      items.push({ label: 'Favoriter', kind: vscode.QuickPickItemKind.Separator });
      for (const r of favorites) {
        items.push({
          label: `⭐ ${r.command ? `/${r.command}` : '💬'} ${this.truncate(r.prompt, 60)}`,
          description: r.agentId,
          detail: `${new Date(r.timestamp).toLocaleString()} | ${r.durationMs}ms | ${r.success ? '✅' : '❌'}`,
          recordId: r.id,
        });
      }
    }

    // Senaste
    const recent = this.recent(20).filter((r) => !r.favorite);
    if (recent.length > 0) {
      items.push({ label: 'Senaste', kind: vscode.QuickPickItemKind.Separator });
      for (const r of recent) {
        items.push({
          label: `${r.command ? `/${r.command}` : '💬'} ${this.truncate(r.prompt, 60)}`,
          description: r.agentId,
          detail: `${new Date(r.timestamp).toLocaleString()} | ${r.durationMs}ms | ${r.success ? '✅' : '❌'}`,
          recordId: r.id,
        });
      }
    }

    // Actions
    items.push(
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(search) Sök i historik...', action: 'search' },
      { label: '$(graph) Visa statistik', action: 'stats' },
      { label: '$(trash) Rensa historik', action: 'clear' },
    );

    const pick = await vscode.window.showQuickPick(items, {
      title: 'Kommandohistorik',
      placeHolder: 'Välj kommando att replaya...',
    });

    if (!pick) { return undefined; }

    if (pick.action === 'search') {
      return this.showSearchPicker();
    }

    if (pick.action === 'stats') {
      await this.showStats();
      return undefined;
    }

    if (pick.action === 'clear') {
      const confirm = await vscode.window.showWarningMessage(
        'Rensa hela kommandohistoriken?',
        { modal: true },
        'Ja, rensa'
      );
      if (confirm) {
        this.clear();
        vscode.window.showInformationMessage('Historik rensad.');
      }
      return undefined;
    }

    if (pick.recordId) {
      const record = this.get(pick.recordId);
      if (record) {
        this._onDidReplay.fire(record);
      }
      return record;
    }

    return undefined;
  }

  /**
   * Visa sök-QuickPick.
   */
  private async showSearchPicker(): Promise<CommandRecord | undefined> {
    const query = await vscode.window.showInputBox({
      prompt: 'Sök i kommandohistoriken',
      placeHolder: 'Ange sökord...',
    });
    if (!query) { return undefined; }

    const results = this.search({ query, limit: 30 });
    if (results.length === 0) {
      vscode.window.showInformationMessage(`Inga träffar för "${query}".`);
      return undefined;
    }

    const pick = await vscode.window.showQuickPick(
      results.map((r) => ({
        label: `${r.command ? `/${r.command}` : '💬'} ${this.truncate(r.prompt, 60)}`,
        description: r.agentId,
        detail: `${new Date(r.timestamp).toLocaleString()} | ${r.durationMs}ms`,
        recordId: r.id,
      })),
      { title: `Sökresultat: "${query}"` }
    );

    if (pick?.recordId) {
      const record = this.get(pick.recordId);
      if (record) {
        this._onDidReplay.fire(record);
      }
      return record;
    }
    return undefined;
  }

  /**
   * Visa statistik i editor.
   */
  async showStats(): Promise<void> {
    const s = this.stats();
    const lines = [
      '# 📊 Kommandohistorik — Statistik\n',
      `- **Totalt:** ${s.total} kommandon`,
      `- **Favoriter:** ${s.favorites}`,
      `- **Framgångsgrad:** ${(s.successRate * 100).toFixed(1)}%`,
      `- **Snittid:** ${s.avgDurationMs.toFixed(0)}ms`,
      '',
      '## Mest använda kommandon\n',
      '| Kommando | Antal |',
      '| --- | --- |',
      ...s.mostUsedCommands.slice(0, 15).map((c) => `| /${c.command} | ${c.count} |`),
      '',
      '## Per agent\n',
      '| Agent | Antal |',
      '| --- | --- |',
      ...Object.entries(s.byAgent)
        .sort(([, a], [, b]) => b - a)
        .map(([agent, count]) => `| ${agent} | ${count} |`),
      '',
      '## Aktivitet (senaste dagarna)\n',
      '| Datum | Kommandon |',
      '| --- | --- |',
      ...s.recentActivity.map((d) => `| ${d.date} | ${d.count} |`),
    ];

    const doc = await vscode.workspace.openTextDocument({
      content: lines.join('\n'),
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Beräkna statistik.
   */
  stats(): HistoryStats {
    const byCommand: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    const byDate: Record<string, number> = {};
    let totalDuration = 0;
    let successes = 0;
    let favorites = 0;

    for (const r of this.records) {
      const cmd = r.command ?? '(auto)';
      byCommand[cmd] = (byCommand[cmd] ?? 0) + 1;
      byAgent[r.agentId] = (byAgent[r.agentId] ?? 0) + 1;
      totalDuration += r.durationMs;
      if (r.success) { successes++; }
      if (r.favorite) { favorites++; }

      const dateKey = new Date(r.timestamp).toISOString().slice(0, 10);
      byDate[dateKey] = (byDate[dateKey] ?? 0) + 1;
    }

    const mostUsedCommands = Object.entries(byCommand)
      .sort(([, a], [, b]) => b - a)
      .map(([command, count]) => ({ command, count }));

    const recentActivity = Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14)
      .map(([date, count]) => ({ date, count }));

    return {
      total: this.records.length,
      favorites,
      successRate: this.records.length > 0 ? successes / this.records.length : 0,
      avgDurationMs: this.records.length > 0 ? totalDuration / this.records.length : 0,
      byCommand,
      byAgent,
      mostUsedCommands,
      recentActivity,
    };
  }

  /**
   * Rensa all historik (utom favoriter om keepFavorites).
   */
  clear(keepFavorites = false): void {
    if (keepFavorites) {
      this.records = this.records.filter((r) => r.favorite);
    } else {
      this.records = [];
    }
    this.persist();
    this._onDidChange.fire();
  }

  /** Antal poster */
  get count(): number {
    return this.records.length;
  }

  // ─── Privata helpers ──────────────────────

  private load(): void {
    this.records = this.globalState.get<CommandRecord[]>(
      CommandHistory.STORAGE_KEY,
      []
    );
  }

  private persist(): void {
    this.globalState.update(CommandHistory.STORAGE_KEY, this.records);
  }

  private generateId(): string {
    return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text;
  }

  dispose(): void {
    this._onDidChange.dispose();
    this._onDidReplay.dispose();
  }
}
