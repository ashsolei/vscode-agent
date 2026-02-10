import * as vscode from 'vscode';

/**
 * Representerar en planerad filändring.
 */
export interface FileDiff {
  /** Relativ sökväg */
  path: string;
  /** Typ av ändring */
  type: 'create' | 'modify' | 'delete';
  /** Ursprungligt innehåll (för modify/delete) */
  original?: string;
  /** Nytt innehåll (för create/modify) */
  proposed?: string;
}

/**
 * DiffPreview — förhandsgranska autonoma filändringar innan de appliceras.
 *
 * Visar en interaktiv diff-vy där användaren kan:
 * - Se alla planerade ändringar
 * - Acceptera / Avvisa individuella filer
 * - Acceptera / Avvisa alla ändringar
 * - Redigera föreslagna ändringar innan accept
 */
export class DiffPreview implements vscode.Disposable {
  private pendingDiffs: FileDiff[] = [];
  private disposables: vscode.Disposable[] = [];

  constructor() {}

  /**
   * Lägg till en planerad ändring för förhandsgranskning.
   */
  addDiff(diff: FileDiff): void {
    // Ersätt om redan finns för samma sökväg
    const existing = this.pendingDiffs.findIndex((d) => d.path === diff.path);
    if (existing >= 0) {
      this.pendingDiffs[existing] = diff;
    } else {
      this.pendingDiffs.push(diff);
    }
  }

  /**
   * Lägg till flera ändringar.
   */
  addDiffs(diffs: FileDiff[]): void {
    for (const diff of diffs) {
      this.addDiff(diff);
    }
  }

  /**
   * Rensa alla pending diffs.
   */
  clear(): void {
    this.pendingDiffs = [];
  }

  /**
   * Antal väntande ändringar.
   */
  get count(): number {
    return this.pendingDiffs.length;
  }

  /**
   * Visa interaktiv förhandsgranskning av alla ändringar.
   * Returnerar true om användaren accepterade.
   */
  async showPreview(): Promise<{ accepted: FileDiff[]; rejected: FileDiff[] }> {
    if (this.pendingDiffs.length === 0) {
      vscode.window.showInformationMessage('Inga ändringar att förhandsgranska.');
      return { accepted: [], rejected: [] };
    }

    // Visa QuickPick med alla ändringar
    const items: (vscode.QuickPickItem & { diff: FileDiff })[] = this.pendingDiffs.map((d) => ({
      label: this.getIcon(d.type) + ' ' + d.path,
      description: d.type,
      detail: this.getSummary(d),
      picked: true,
      diff: d,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: `🔍 Förhandsgranska ${this.pendingDiffs.length} ändringar`,
      placeHolder: 'Välj vilka ändringar som ska appliceras (avmarkera för att avvisa)',
      canPickMany: true,
    });

    if (!selected) {
      // Användaren avbröt
      return { accepted: [], rejected: this.pendingDiffs };
    }

    const acceptedPaths = new Set(selected.map((s) => s.diff.path));
    const accepted = this.pendingDiffs.filter((d) => acceptedPaths.has(d.path));
    const rejected = this.pendingDiffs.filter((d) => !acceptedPaths.has(d.path));

    return { accepted, rejected };
  }

  /**
   * Visa inline diff för en specifik fil.
   */
  async showFileDiff(diff: FileDiff): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return; }

    if (diff.type === 'create' && diff.proposed) {
      // Visa föreslaget innehåll i nytt dokument
      const doc = await vscode.workspace.openTextDocument({
        content: diff.proposed,
        language: this.guessLanguage(diff.path),
      });
      await vscode.window.showTextDocument(doc);
      return;
    }

    if (diff.type === 'modify' && diff.original && diff.proposed) {
      // Skapa temporära dokument för diff-vy
      const origDoc = await vscode.workspace.openTextDocument({
        content: diff.original,
        language: this.guessLanguage(diff.path),
      });
      const propDoc = await vscode.workspace.openTextDocument({
        content: diff.proposed,
        language: this.guessLanguage(diff.path),
      });

      // Öppna diff-vy
      await vscode.commands.executeCommand(
        'vscode.diff',
        origDoc.uri,
        propDoc.uri,
        `${diff.path} (Original ↔ Föreslagen)`
      );
      return;
    }

    if (diff.type === 'delete') {
      const fileUri = vscode.Uri.joinPath(ws.uri, diff.path);
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);
        vscode.window.showWarningMessage(
          `Denna fil (${diff.path}) kommer att tas bort.`
        );
      } catch {
        // Filen kanske redan borttagen
      }
    }
  }

  /**
   * Applicera accepterade ändringar till arbetsytan.
   */
  async applyDiffs(diffs: FileDiff[]): Promise<{ applied: number; failed: number }> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return { applied: 0, failed: 0 }; }

    let applied = 0;
    let failed = 0;

    for (const diff of diffs) {
      try {
        const uri = vscode.Uri.joinPath(ws.uri, diff.path);

        switch (diff.type) {
          case 'create':
          case 'modify':
            if (diff.proposed) {
              await vscode.workspace.fs.writeFile(
                uri,
                new TextEncoder().encode(diff.proposed)
              );
              applied++;
            }
            break;

          case 'delete':
            await vscode.workspace.fs.delete(uri);
            applied++;
            break;
        }
      } catch {
        failed++;
      }
    }

    // Rensa applicerade
    const appliedPaths = new Set(diffs.map((d) => d.path));
    this.pendingDiffs = this.pendingDiffs.filter((d) => !appliedPaths.has(d.path));

    return { applied, failed };
  }

  /**
   * Full preview-workflow: visa → acceptera → applicera.
   * Returnerar antal applicerade ändringar.
   */
  async reviewAndApply(
    stream?: vscode.ChatResponseStream
  ): Promise<{ applied: number; rejected: number }> {
    stream?.markdown(`\n### 🔍 Förhandsgranskning (${this.pendingDiffs.length} ändringar)\n`);

    for (const diff of this.pendingDiffs) {
      const icon = this.getIcon(diff.type);
      stream?.markdown(`- ${icon} \`${diff.path}\` — ${diff.type}\n`);
    }

    const { accepted, rejected } = await this.showPreview();

    if (accepted.length > 0) {
      const result = await this.applyDiffs(accepted);
      stream?.markdown(
        `\n✅ Applicerat ${result.applied} ändringar, ${rejected.length} avvisade`
      );

      if (result.failed > 0) {
        stream?.markdown(`, ${result.failed} misslyckade`);
      }

      stream?.markdown('\n');
      return { applied: result.applied, rejected: rejected.length };
    } else {
      stream?.markdown('\n❌ Alla ändringar avvisade av användaren.\n');
      return { applied: 0, rejected: rejected.length };
    }
  }

  // ─── Helpers ───────────────────────────────

  private getIcon(type: FileDiff['type']): string {
    switch (type) {
      case 'create': return '🆕';
      case 'modify': return '✏️';
      case 'delete': return '🗑️';
    }
  }

  private getSummary(diff: FileDiff): string {
    switch (diff.type) {
      case 'create':
        return `Ny fil (${(diff.proposed?.length ?? 0)} tecken)`;
      case 'modify':
        return `Ändrad (${(diff.original?.length ?? 0)} → ${(diff.proposed?.length ?? 0)} tecken)`;
      case 'delete':
        return 'Tas bort';
    }
  }

  private guessLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescriptreact',
      js: 'javascript', jsx: 'javascriptreact',
      py: 'python', rs: 'rust', go: 'go',
      json: 'json', yaml: 'yaml', yml: 'yaml',
      md: 'markdown', html: 'html', css: 'css',
      scss: 'scss', sql: 'sql', sh: 'shellscript',
      java: 'java', c: 'c', cpp: 'cpp',
      cs: 'csharp', rb: 'ruby', php: 'php',
      swift: 'swift', kt: 'kotlin', dart: 'dart',
    };
    return map[ext] ?? 'plaintext';
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
