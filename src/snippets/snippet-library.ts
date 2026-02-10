import * as vscode from 'vscode';

/**
 * Ett sparat snippet från en agent-körning.
 */
export interface AgentSnippet {
  /** Unikt ID */
  id: string;
  /** Titel */
  title: string;
  /** Agent som genererade det */
  agentId: string;
  /** Originalprompt */
  prompt: string;
  /** Agentens svar */
  content: string;
  /** Programmeringsspråk (om applicerbart) */
  language?: string;
  /** Taggar */
  tags: string[];
  /** Tidsstämpel */
  createdAt: number;
  /** Favorit */
  favorite: boolean;
}

/**
 * SnippetLibrary — spara, sök och återanvänd lyckade agent-outputs.
 *
 * Features:
 * - Spara alla typer av agent-output (kod, docs, config)
 * - Sök med nyckelord / taggar
 * - Favorit-markering
 * - Infoga snippet i aktiv editor
 * - Exportera / importera snippets
 * - Persistent lagring via globalState
 */
export class SnippetLibrary implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'agent-snippets';
  private snippets: AgentSnippet[] = [];
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private globalState: vscode.Memento) {
    this.load();
  }

  // ─── CRUD ───────────────────────────────────

  /**
   * Spara ett nytt snippet.
   */
  save(snippet: Omit<AgentSnippet, 'id' | 'createdAt' | 'favorite'>): AgentSnippet {
    const entry: AgentSnippet = {
      ...snippet,
      id: this.generateId(),
      createdAt: Date.now(),
      favorite: false,
    };

    this.snippets.push(entry);
    this.persist();
    this._onDidChange.fire();
    return entry;
  }

  /**
   * Ta bort ett snippet.
   */
  delete(id: string): boolean {
    const before = this.snippets.length;
    this.snippets = this.snippets.filter((s) => s.id !== id);
    if (this.snippets.length < before) {
      this.persist();
      this._onDidChange.fire();
      return true;
    }
    return false;
  }

  /**
   * Favorit-togglea.
   */
  toggleFavorite(id: string): boolean {
    const snippet = this.snippets.find((s) => s.id === id);
    if (snippet) {
      snippet.favorite = !snippet.favorite;
      this.persist();
      this._onDidChange.fire();
      return snippet.favorite;
    }
    return false;
  }

  /**
   * Hämta alla snippets.
   */
  list(options?: { agentId?: string; tag?: string; favorite?: boolean }): AgentSnippet[] {
    let result = [...this.snippets];

    if (options?.agentId) {
      result = result.filter((s) => s.agentId === options.agentId);
    }
    if (options?.tag) {
      result = result.filter((s) => s.tags.includes(options.tag!));
    }
    if (options?.favorite) {
      result = result.filter((s) => s.favorite);
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Sök snippets med nyckelord.
   */
  search(query: string): AgentSnippet[] {
    const terms = query.toLowerCase().split(/\s+/);

    return this.snippets
      .filter((s) => {
        const text = `${s.title} ${s.prompt} ${s.content} ${s.tags.join(' ')}`.toLowerCase();
        return terms.every((t) => text.includes(t));
      })
      .sort((a, b) => {
        // Favoriter först, sedan nyast
        if (a.favorite !== b.favorite) { return a.favorite ? -1 : 1; }
        return b.createdAt - a.createdAt;
      });
  }

  /**
   * Hämta ett snippet.
   */
  get(id: string): AgentSnippet | undefined {
    return this.snippets.find((s) => s.id === id);
  }

  // ─── Interaktivt ────────────────────────────

  /**
   * Visa QuickPick för att välja och infoga ett snippet.
   */
  async pickAndInsert(): Promise<void> {
    if (this.snippets.length === 0) {
      vscode.window.showInformationMessage('Inga sparade snippets.');
      return;
    }

    const items = this.snippets
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        label: `${s.favorite ? '⭐ ' : ''}${s.title}`,
        description: `${s.agentId} | ${new Date(s.createdAt).toLocaleDateString()}`,
        detail: s.prompt.substring(0, 80),
        snippet: s,
      }));

    const selected = await vscode.window.showQuickPick(items, {
      title: '📋 Välj snippet att infoga',
      placeHolder: 'Sök bland sparade snippets...',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await editor.edit((edit) => {
          edit.insert(editor.selection.active, selected.snippet.content);
        });
      } else {
        // Öppna i nytt dokument
        const doc = await vscode.workspace.openTextDocument({
          content: selected.snippet.content,
          language: selected.snippet.language ?? 'plaintext',
        });
        await vscode.window.showTextDocument(doc);
      }
    }
  }

  /**
   * Snabb-spara från chatten — fråga om titel.
   */
  async quickSave(
    agentId: string,
    prompt: string,
    content: string
  ): Promise<AgentSnippet | null> {
    const title = await vscode.window.showInputBox({
      prompt: 'Ge snippet ett namn',
      placeHolder: 'T.ex. "React useAuth hook"',
    });

    if (!title) { return null; }

    const tagInput = await vscode.window.showInputBox({
      prompt: 'Taggar (kommaseparerade, valfritt)',
      placeHolder: 'react, hook, auth',
    });

    const tags = tagInput
      ? tagInput.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    // Detektera språk
    const language = this.detectLanguage(content);

    return this.save({ title, agentId, prompt, content, language, tags });
  }

  /**
   * Visa alla snippets i ett webview-liknande dokument.
   */
  async showLibrary(): Promise<void> {
    const snippets = this.list();
    if (snippets.length === 0) {
      vscode.window.showInformationMessage('Snippet-biblioteket är tomt.');
      return;
    }

    const lines: string[] = ['# 📋 Snippet Library\n'];
    lines.push(`Totalt: ${snippets.length} snippets\n`);

    for (const s of snippets) {
      const date = new Date(s.createdAt).toLocaleString();
      const fav = s.favorite ? '⭐ ' : '';
      lines.push(`## ${fav}${s.title}`);
      lines.push(`*Agent:* \`${s.agentId}\` | *Datum:* ${date} | *Taggar:* ${s.tags.join(', ') || 'inga'}\n`);
      lines.push(`*Prompt:* ${s.prompt.substring(0, 100)}\n`);
      lines.push('```' + (s.language ?? ''));
      lines.push(s.content.substring(0, 500));
      if (s.content.length > 500) { lines.push('...'); }
      lines.push('```\n');
    }

    const doc = await vscode.workspace.openTextDocument({
      content: lines.join('\n'),
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Exportera alla snippets som JSON.
   */
  async exportSnippets(): Promise<void> {
    const json = JSON.stringify(this.snippets, null, 2);
    const doc = await vscode.workspace.openTextDocument({
      content: json,
      language: 'json',
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(
      `Exportade ${this.snippets.length} snippets. Spara filen manuellt.`
    );
  }

  /**
   * Importera snippets från JSON.
   */
  async importSnippets(): Promise<number> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Öppna en JSON-fil med snippets först.');
      return 0;
    }

    try {
      const imported = JSON.parse(editor.document.getText()) as AgentSnippet[];
      let count = 0;

      for (const s of imported) {
        if (s.title && s.content && !this.snippets.find((e) => e.id === s.id)) {
          this.snippets.push({ ...s, id: s.id || this.generateId() });
          count++;
        }
      }

      if (count > 0) {
        this.persist();
        this._onDidChange.fire();
      }

      vscode.window.showInformationMessage(`Importerade ${count} nya snippets.`);
      return count;
    } catch {
      vscode.window.showErrorMessage('Ogiltig JSON.');
      return 0;
    }
  }

  // ─── Stats ──────────────────────────────────

  stats(): {
    total: number;
    favorites: number;
    byAgent: Record<string, number>;
    byLanguage: Record<string, number>;
  } {
    const byAgent: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    let favorites = 0;

    for (const s of this.snippets) {
      byAgent[s.agentId] = (byAgent[s.agentId] ?? 0) + 1;
      if (s.language) {
        byLanguage[s.language] = (byLanguage[s.language] ?? 0) + 1;
      }
      if (s.favorite) { favorites++; }
    }

    return { total: this.snippets.length, favorites, byAgent, byLanguage };
  }

  // ─── Privata helpers ────────────────────────

  private load(): void {
    this.snippets = this.globalState.get<AgentSnippet[]>(
      SnippetLibrary.STORAGE_KEY,
      []
    );
  }

  private persist(): void {
    this.globalState.update(SnippetLibrary.STORAGE_KEY, this.snippets);
  }

  private generateId(): string {
    return `snip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private detectLanguage(content: string): string | undefined {
    // Heuristik baserad på innehåll
    if (/^import .+ from |^export (class|function|const|default)/.test(content)) {
      return content.includes(': ') ? 'typescript' : 'javascript';
    }
    if (/^(def |class |import |from .+ import)/.test(content)) { return 'python'; }
    if (/^(fn |struct |impl |use |mod )/.test(content)) { return 'rust'; }
    if (/^(func |package |import ")/m.test(content)) { return 'go'; }
    if (/^(<\?php|namespace |use .+;$)/m.test(content)) { return 'php'; }
    if (/<[a-z]+[\s>].*<\/[a-z]+>/is.test(content)) { return 'html'; }
    if (/^(SELECT|INSERT|CREATE|ALTER|DROP)\s/im.test(content)) { return 'sql'; }
    if (/^\{[\s\n]*"/.test(content)) { return 'json'; }
    if (/^[a-z-]+:\s/m.test(content)) { return 'yaml'; }
    return undefined;
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
