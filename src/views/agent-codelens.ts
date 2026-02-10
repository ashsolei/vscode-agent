import * as vscode from 'vscode';

/**
 * AgentCodeLensProvider — visar inline-knappar direkt i koden.
 *
 * Detekterar:
 * - Funktioner utan dokumentation → "🤖 Dokumentera"
 * - TODO/FIXME/HACK-kommentarer → "🤖 Fixa"
 * - Stora funktioner (>50 rader) → "🤖 Refaktorera"
 * - Export-klasser → "🤖 Generera tester"
 */
export class AgentCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (!this.enabled) { return []; }

    const lenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // TODO/FIXME/HACK-kommentarer
      const todoMatch = trimmed.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)[\s:](.*)/i);
      if (todoMatch) {
        const range = new vscode.Range(i, 0, i, line.length);
        lenses.push(new vscode.CodeLens(range, {
          title: `🤖 Fixa ${todoMatch[1]}`,
          command: 'workbench.action.chat.open',
          arguments: [{ query: `@agent /autofix Fixa denna ${todoMatch[1]}: ${todoMatch[2].trim()}` }],
        }));
      }

      // Funktion utan JSDoc (ej privat, ej i interface)
      const funcMatch = trimmed.match(
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:public\s+)?(?:async\s+)?(\w+)\s*\(/
      );
      if (funcMatch && i > 0) {
        const prevLine = lines[i - 1]?.trim() ?? '';
        if (!prevLine.endsWith('*/') && !prevLine.startsWith('*') && !prevLine.startsWith('//')) {
          const funcName = funcMatch[1] ?? funcMatch[2];
          if (funcName && !funcName.startsWith('_')) {
            const range = new vscode.Range(i, 0, i, line.length);
            lenses.push(new vscode.CodeLens(range, {
              title: '📝 Dokumentera',
              command: 'workbench.action.chat.open',
              arguments: [{ query: `@agent /docs Generera JSDoc för funktionen "${funcName}" på rad ${i + 1}` }],
            }));
          }
        }
      }

      // Stor funktion (> 50 rader)
      const blockStart = trimmed.match(
        /^(?:export\s+)?(?:async\s+)?function\s+\w+|^(?:export\s+)?class\s+\w+/
      );
      if (blockStart) {
        // Räkna rader till matchande }
        let depth = 0;
        let started = false;
        let endLine = i;

        for (let j = i; j < lines.length; j++) {
          for (const ch of lines[j]) {
            if (ch === '{') { depth++; started = true; }
            if (ch === '}') { depth--; }
          }
          if (started && depth === 0) {
            endLine = j;
            break;
          }
        }

        const size = endLine - i;
        if (size > 50) {
          const range = new vscode.Range(i, 0, i, line.length);
          lenses.push(new vscode.CodeLens(range, {
            title: `⚡ Refaktorera (${size} rader)`,
            command: 'workbench.action.chat.open',
            arguments: [{ query: `@agent /refactor Denna funktion/klass är ${size} rader lång. Bryt upp den.` }],
          }));
        }
      }

      // Exporterad klass → generera tester
      if (trimmed.match(/^export\s+(default\s+)?class\s+(\w+)/)) {
        const className = trimmed.match(/class\s+(\w+)/)?.[1];
        if (className) {
          const range = new vscode.Range(i, 0, i, line.length);
          lenses.push(new vscode.CodeLens(range, {
            title: '🧪 Generera tester',
            command: 'workbench.action.chat.open',
            arguments: [{ query: `@agent /test Generera enhetstester för klassen "${className}"` }],
          }));
        }
      }
    }

    return lenses;
  }
}
