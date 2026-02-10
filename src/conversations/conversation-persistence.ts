import * as vscode from 'vscode';

/**
 * Ett sparat meddelande i en konversation.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;
  command?: string;
  timestamp: number;
}

/**
 * En sparad konversation.
 */
export interface SavedConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  tags: string[];
  pinned: boolean;
  /** Antal meddelanden */
  messageCount: number;
}

const CONVERSATIONS_KEY = 'agent.conversations';
const CURRENT_KEY = 'agent.currentConversation';
const MAX_CONVERSATIONS = 100;

export class ConversationPersistence implements vscode.Disposable {
  private conversations: Map<string, SavedConversation> = new Map();
  private currentId: string | undefined;
  private currentMessages: ChatMessage[] = [];

  constructor(private readonly globalState: vscode.Memento) {
    this.load();
  }

  /* ─── Core ─── */

  /** Ladda från persistent state */
  private load(): void {
    const saved = this.globalState.get<SavedConversation[]>(CONVERSATIONS_KEY, []);
    for (const c of saved) {
      this.conversations.set(c.id, c);
    }
    this.currentId = this.globalState.get<string>(CURRENT_KEY);
    if (this.currentId && this.conversations.has(this.currentId)) {
      this.currentMessages = [...this.conversations.get(this.currentId)!.messages];
    }
  }

  /** Spara till persistent state */
  private async save(): Promise<void> {
    const all = [...this.conversations.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
    await this.globalState.update(CONVERSATIONS_KEY, all);
    await this.globalState.update(CURRENT_KEY, this.currentId);
  }

  /** Lägg till ett meddelande i pågående konversation */
  async addMessage(msg: ChatMessage): Promise<void> {
    this.currentMessages.push(msg);

    // Auto-skapa konversation om det inte finns
    if (!this.currentId) {
      this.currentId = this.generateId();
      const title = this.deriveTitle(msg.content);
      this.conversations.set(this.currentId, {
        id: this.currentId,
        title,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        pinned: false,
        messageCount: 0,
      });
    }

    const conv = this.conversations.get(this.currentId)!;
    conv.messages = [...this.currentMessages];
    conv.updatedAt = Date.now();
    conv.messageCount = conv.messages.length;
    await this.save();
  }

  /** Spara aktuell konversation explicit */
  async saveCurrentAs(title?: string): Promise<SavedConversation | undefined> {
    if (this.currentMessages.length === 0) {
      vscode.window.showWarningMessage('Ingen konversation att spara.');
      return;
    }

    const id = this.currentId || this.generateId();
    const finalTitle = title ?? await vscode.window.showInputBox({
      prompt: 'Ge konversationen ett namn',
      value: this.deriveTitle(this.currentMessages[0]?.content ?? 'Ny konversation'),
    });

    if (!finalTitle) { return; }

    const conv: SavedConversation = {
      id,
      title: finalTitle,
      messages: [...this.currentMessages],
      createdAt: this.conversations.get(id)?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      tags: [],
      pinned: false,
      messageCount: this.currentMessages.length,
    };

    this.conversations.set(id, conv);
    this.currentId = id;
    await this.save();
    vscode.window.showInformationMessage(`💾 Konversation sparad: "${finalTitle}"`);
    return conv;
  }

  /** Ny konversation — nollställer state */
  async startNew(): Promise<void> {
    // Spara automatiskt om det finns meddelanden
    if (this.currentMessages.length > 0 && this.currentId) {
      await this.save();
    }
    this.currentId = undefined;
    this.currentMessages = [];
    await this.globalState.update(CURRENT_KEY, undefined);
  }

  /** Ladda en sparad konversation */
  async loadConversation(id: string): Promise<SavedConversation | undefined> {
    const conv = this.conversations.get(id);
    if (!conv) { return undefined; }
    this.currentId = id;
    this.currentMessages = [...conv.messages];
    await this.globalState.update(CURRENT_KEY, id);
    return conv;
  }

  /* ─── Listing & Search ─── */

  /** Lista alla konversationer */
  list(options?: { pinned?: boolean; tag?: string }): SavedConversation[] {
    let result = [...this.conversations.values()].sort((a, b) => b.updatedAt - a.updatedAt);

    if (options?.pinned !== undefined) {
      result = result.filter((c) => c.pinned === options.pinned);
    }
    if (options?.tag) {
      result = result.filter((c) => c.tags.includes(options.tag!));
    }
    return result;
  }

  /** Sök konversationer */
  search(query: string): SavedConversation[] {
    const q = query.toLowerCase();
    return [...this.conversations.values()]
      .filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /* ─── Operations ─── */

  /** Ta bort konversation */
  async remove(id: string): Promise<boolean> {
    const deleted = this.conversations.delete(id);
    if (this.currentId === id) {
      this.currentId = undefined;
      this.currentMessages = [];
    }
    await this.save();
    return deleted;
  }

  /** Tagga konversation */
  async tag(id: string, tags: string[]): Promise<void> {
    const conv = this.conversations.get(id);
    if (!conv) { return; }
    conv.tags = [...new Set([...conv.tags, ...tags])];
    await this.save();
  }

  /** Pin/unpin */
  async togglePin(id: string): Promise<void> {
    const conv = this.conversations.get(id);
    if (!conv) { return; }
    conv.pinned = !conv.pinned;
    await this.save();
  }

  /** Visa konversation i editor */
  async showConversation(id: string): Promise<void> {
    const conv = this.conversations.get(id);
    if (!conv) { return; }

    const lines: string[] = [
      `# ${conv.title}`,
      `*Skapad: ${new Date(conv.createdAt).toLocaleString()}*`,
      `*Uppdaterad: ${new Date(conv.updatedAt).toLocaleString()}*`,
      conv.tags.length > 0 ? `*Taggar: ${conv.tags.join(', ')}*` : '',
      '',
      '---',
      '',
    ];

    for (const msg of conv.messages) {
      const role = msg.role === 'user' ? '👤 User' : `🤖 Agent${msg.agentId ? ` (${msg.agentId})` : ''}`;
      lines.push(`## ${role}`);
      if (msg.command) {
        lines.push(`*Kommando: /${msg.command}*`);
      }
      lines.push('');
      lines.push(msg.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    const doc = await vscode.workspace.openTextDocument({
      content: lines.join('\n'),
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }

  /** Exportera till JSON */
  async exportConversation(id: string): Promise<void> {
    const conv = this.conversations.get(id);
    if (!conv) { return; }
    const json = JSON.stringify(conv, null, 2);
    const doc = await vscode.workspace.openTextDocument({ content: json, language: 'json' });
    await vscode.window.showTextDocument(doc);
  }

  /** Importera från JSON */
  async importConversation(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      filters: { JSON: ['json'] },
      canSelectMany: false,
    });
    if (!uris || uris.length === 0) { return; }

    const content = await vscode.workspace.fs.readFile(uris[0]);
    try {
      const conv = JSON.parse(Buffer.from(content).toString('utf-8')) as SavedConversation;
      if (!conv.id || !conv.messages) {
        throw new Error('Invalid format');
      }
      conv.id = this.generateId(); // Nytt ID för att undvika kollision
      this.conversations.set(conv.id, conv);
      await this.save();
      vscode.window.showInformationMessage(`Konversation importerad: "${conv.title}"`);
    } catch {
      vscode.window.showErrorMessage('Ogiltigt konversationsformat.');
    }
  }

  /** QuickPick: välj konversation */
  async showPicker(): Promise<SavedConversation | undefined> {
    const items: (vscode.QuickPickItem & { convId?: string; action?: string })[] = [];

    const pinned = this.list({ pinned: true });
    if (pinned.length > 0) {
      items.push({ label: 'Pinnade', kind: vscode.QuickPickItemKind.Separator });
      for (const c of pinned) {
        items.push({
          label: `📌 ${c.title}`,
          description: `${c.messageCount} meddelanden`,
          detail: new Date(c.updatedAt).toLocaleString(),
          convId: c.id,
        });
      }
    }

    const recent = this.list().filter((c) => !c.pinned).slice(0, 20);
    if (recent.length > 0) {
      items.push({ label: 'Senaste', kind: vscode.QuickPickItemKind.Separator });
      for (const c of recent) {
        items.push({
          label: c.title,
          description: `${c.messageCount} meddelanden`,
          detail: new Date(c.updatedAt).toLocaleString(),
          convId: c.id,
        });
      }
    }

    items.push(
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(add) Ny konversation', action: 'new' },
      { label: '$(search) Sök...', action: 'search' },
      { label: '$(cloud-download) Importera...', action: 'import' },
    );

    const pick = await vscode.window.showQuickPick(items, {
      title: 'Konversationer',
      placeHolder: 'Välj eller sök konversation...',
    });

    if (!pick) { return; }

    if (pick.action === 'new') {
      await this.startNew();
    } else if (pick.action === 'search') {
      const query = await vscode.window.showInputBox({ prompt: 'Sökord' });
      if (query) {
        const results = this.search(query);
        if (results.length === 0) {
          vscode.window.showInformationMessage('Inga träffar.');
        } else {
          const resultPick = await vscode.window.showQuickPick(
            results.map((c) => ({ label: c.title, description: `${c.messageCount} msg`, convId: c.id })),
            { title: `Sökresultat: "${query}"` }
          );
          if (resultPick?.convId) {
            return this.loadConversation(resultPick.convId);
          }
        }
      }
    } else if (pick.action === 'import') {
      await this.importConversation();
    } else if (pick.convId) {
      return this.loadConversation(pick.convId);
    }
  }

  /** Aktuella meddelanden */
  get currentChat(): ChatMessage[] {
    return [...this.currentMessages];
  }

  /** Antal sparade */
  get count(): number {
    return this.conversations.size;
  }

  /* ─── Helpers ─── */

  private generateId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private deriveTitle(content: string): string {
    const cleaned = content.replace(/[#*_`>]/g, '').trim();
    return cleaned.length > 50 ? cleaned.slice(0, 47) + '...' : cleaned || 'Ny konversation';
  }

  dispose(): void {
    // Spara sista state
    if (this.currentMessages.length > 0 && this.currentId) {
      this.save();
    }
  }
}
