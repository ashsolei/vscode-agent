import * as vscode from 'vscode';

/**
 * Kontext-typ som en provider kan leverera.
 */
export interface ContextChunk {
  /** Typ av kontext */
  type: 'git-diff' | 'open-files' | 'diagnostics' | 'workspace-info' | 'selection' | 'git-log' | 'dependencies' | 'custom';
  /** Läsbart namn */
  label: string;
  /** Kontextens innehåll */
  content: string;
  /** Prioritet (högre = viktigare, inkluderas först) */
  priority: number;
  /** Uppskattad token-storlek */
  tokenEstimate: number;
}

/**
 * ContextProviderRegistry — samlar arbetsytekontext för agenter automatiskt.
 *
 * Providers:
 * - Git diff (staged + unstaged)
 * - Öppna filer (aktiva editorer)
 * - Diagnostik (fel + varningar)
 * - Workspace-info (språk, storlek, struktur)
 * - Urval (markerad kod)
 * - Git-logg (senaste commits)
 * - Beroenden (package.json, requirements.txt)
 */
export class ContextProviderRegistry implements vscode.Disposable {
  private providers = new Map<string, () => Promise<ContextChunk | null>>();
  private cachedContext: ContextChunk[] = [];
  private cacheTime = 0;
  private cacheTTL = 5000; // 5 sekunder

  constructor() {
    // Registrera inbyggda providers
    this.registerBuiltins();
  }

  /**
   * Hämta all relevant kontext, sorterad efter prioritet.
   * Respekterar en max-token-gräns.
   */
  async gather(maxTokens: number = 4000): Promise<ContextChunk[]> {
    // Använd cache om färsk
    if (Date.now() - this.cacheTime < this.cacheTTL && this.cachedContext.length > 0) {
      return this.fitToTokenBudget(this.cachedContext, maxTokens);
    }

    const chunks: ContextChunk[] = [];

    for (const [_id, provider] of this.providers) {
      try {
        const chunk = await provider();
        if (chunk && chunk.content.trim()) {
          chunks.push(chunk);
        }
      } catch {
        // Ignorera misslyckade providers
      }
    }

    // Sortera efter prioritet (hög först)
    chunks.sort((a, b) => b.priority - a.priority);

    this.cachedContext = chunks;
    this.cacheTime = Date.now();

    return this.fitToTokenBudget(chunks, maxTokens);
  }

  /**
   * Formatera kontext som en prompt-sektion.
   */
  async buildPromptContext(maxTokens: number = 4000): Promise<string> {
    const chunks = await this.gather(maxTokens);
    if (chunks.length === 0) { return ''; }

    const sections = chunks.map((c) =>
      `### ${c.label}\n\`\`\`\n${c.content}\n\`\`\``
    );

    return `\n## 📋 Arbetsytekontext\n\n${sections.join('\n\n')}`;
  }

  /**
   * Registrera en custom context-provider.
   */
  register(id: string, provider: () => Promise<ContextChunk | null>): void {
    this.providers.set(id, provider);
  }

  /**
   * Avregistrera en provider.
   */
  unregister(id: string): void {
    this.providers.delete(id);
  }

  /**
   * Invalidera cache.
   */
  invalidate(): void {
    this.cacheTime = 0;
    this.cachedContext = [];
  }

  // ─── Inbyggda providers ─────────────────────

  private registerBuiltins(): void {
    // 1. Git diff
    this.register('git-diff', async (): Promise<ContextChunk | null> => {
      const gitExt = vscode.extensions.getExtension('vscode.git');
      if (!gitExt?.isActive) { return null; }

      const git = gitExt.exports.getAPI(1);
      const repo = git?.repositories?.[0];
      if (!repo) { return null; }

      const diff = await repo.diff(true); // staged
      const diffUnstaged = await repo.diff(false);
      const combined = [diff, diffUnstaged].filter(Boolean).join('\n');

      if (!combined.trim()) { return null; }

      return {
        type: 'git-diff',
        label: '🔀 Git Diff',
        content: combined.substring(0, 3000),
        priority: 90,
        tokenEstimate: Math.ceil(combined.length / 4),
      };
    });

    // 2. Öppna filer
    this.register('open-files', async (): Promise<ContextChunk | null> => {
      const editors = vscode.window.visibleTextEditors;
      if (editors.length === 0) { return null; }

      const files = editors.map((e) => {
        const rel = vscode.workspace.asRelativePath(e.document.uri);
        const lang = e.document.languageId;
        const lines = e.document.lineCount;
        return `• ${rel} (${lang}, ${lines} rader)`;
      });

      return {
        type: 'open-files',
        label: '📂 Öppna filer',
        content: files.join('\n'),
        priority: 70,
        tokenEstimate: files.join('\n').length / 4,
      };
    });

    // 3. Diagnostik (fel + varningar)
    this.register('diagnostics', async (): Promise<ContextChunk | null> => {
      const allDiags = vscode.languages.getDiagnostics();
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const [uri, diags] of allDiags) {
        const rel = vscode.workspace.asRelativePath(uri);
        for (const d of diags) {
          const severity = d.severity === vscode.DiagnosticSeverity.Error ? 'ERR' : 'WARN';
          const line = `[${severity}] ${rel}:${d.range.start.line + 1} — ${d.message}`;

          if (d.severity === vscode.DiagnosticSeverity.Error) {
            errors.push(line);
          } else if (d.severity === vscode.DiagnosticSeverity.Warning) {
            warnings.push(line);
          }
        }
      }

      if (errors.length === 0 && warnings.length === 0) { return null; }

      const content = [
        errors.length > 0 ? `Fel (${errors.length}):\n${errors.slice(0, 20).join('\n')}` : '',
        warnings.length > 0 ? `Varningar (${warnings.length}):\n${warnings.slice(0, 10).join('\n')}` : '',
      ].filter(Boolean).join('\n\n');

      return {
        type: 'diagnostics',
        label: `⚠️ Diagnostik (${errors.length} fel, ${warnings.length} varningar)`,
        content,
        priority: 95, // Hög prioritet — fel är viktigast
        tokenEstimate: Math.ceil(content.length / 4),
      };
    });

    // 4. Workspace-info
    this.register('workspace-info', async (): Promise<ContextChunk | null> => {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) { return null; }

      const info: string[] = [
        `Namn: ${ws.name}`,
        `Sökväg: ${ws.uri.fsPath}`,
      ];

      // Detektera projekttyp
      try {
        const entries = await vscode.workspace.fs.readDirectory(ws.uri);
        const names = entries.map(([n]) => n);

        if (names.includes('package.json')) { info.push('Typ: Node.js/JavaScript'); }
        if (names.includes('tsconfig.json')) { info.push('Språk: TypeScript'); }
        if (names.includes('Cargo.toml')) { info.push('Typ: Rust'); }
        if (names.includes('go.mod')) { info.push('Typ: Go'); }
        if (names.includes('requirements.txt') || names.includes('pyproject.toml')) {
          info.push('Typ: Python');
        }
        if (names.includes('.git')) { info.push('VCS: Git'); }

        info.push(`Rotfiler: ${names.slice(0, 15).join(', ')}`);
      } catch { /* ignore */ }

      return {
        type: 'workspace-info',
        label: '🏠 Workspace',
        content: info.join('\n'),
        priority: 50,
        tokenEstimate: Math.ceil(info.join('\n').length / 4),
      };
    });

    // 5. Markerad kod (selection)
    this.register('selection', async (): Promise<ContextChunk | null> => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) { return null; }

      const selectedText = editor.document.getText(editor.selection);
      const relPath = vscode.workspace.asRelativePath(editor.document.uri);
      const startLine = editor.selection.start.line + 1;
      const endLine = editor.selection.end.line + 1;

      return {
        type: 'selection',
        label: `✂️ Markerad kod (${relPath}:${startLine}-${endLine})`,
        content: selectedText.substring(0, 2000),
        priority: 100, // Högsta — markering betyder att det är relevant
        tokenEstimate: Math.ceil(selectedText.length / 4),
      };
    });

    // 6. Git-logg (senaste 5 commits)
    this.register('git-log', async (): Promise<ContextChunk | null> => {
      const gitExt = vscode.extensions.getExtension('vscode.git');
      if (!gitExt?.isActive) { return null; }

      const git = gitExt.exports.getAPI(1);
      const repo = git?.repositories?.[0];
      if (!repo) { return null; }

      try {
        const log = await repo.log({ maxEntries: 5 });
        if (!log || log.length === 0) { return null; }

        const entries = log.map((c: any) =>
          `• ${c.hash?.substring(0, 7)} — ${c.message?.split('\n')[0]} (${c.authorName})`
        );

        return {
          type: 'git-log',
          label: '📜 Senaste commits',
          content: entries.join('\n'),
          priority: 40,
          tokenEstimate: Math.ceil(entries.join('\n').length / 4),
        };
      } catch {
        return null;
      }
    });

    // 7. Beroenden
    this.register('dependencies', async (): Promise<ContextChunk | null> => {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) { return null; }

      try {
        const pkgUri = vscode.Uri.joinPath(ws.uri, 'package.json');
        const content = await vscode.workspace.fs.readFile(pkgUri);
        const pkg = JSON.parse(new TextDecoder().decode(content));

        const deps = Object.keys(pkg.dependencies ?? {});
        const devDeps = Object.keys(pkg.devDependencies ?? {});

        if (deps.length === 0 && devDeps.length === 0) { return null; }

        const info = [
          deps.length > 0 ? `Dependencies: ${deps.join(', ')}` : '',
          devDeps.length > 0 ? `DevDependencies: ${devDeps.join(', ')}` : '',
        ].filter(Boolean).join('\n');

        return {
          type: 'dependencies',
          label: '📦 Beroenden',
          content: info,
          priority: 45,
          tokenEstimate: Math.ceil(info.length / 4),
        };
      } catch {
        return null;
      }
    });
  }

  // ─── Helpers ────────────────────────────────

  private fitToTokenBudget(chunks: ContextChunk[], maxTokens: number): ContextChunk[] {
    const result: ContextChunk[] = [];
    let used = 0;

    for (const chunk of chunks) {
      if (used + chunk.tokenEstimate > maxTokens) {
        // Försök trimma
        const remaining = maxTokens - used;
        if (remaining > 100) {
          const trimmed = { ...chunk };
          trimmed.content = chunk.content.substring(0, remaining * 4);
          trimmed.tokenEstimate = remaining;
          result.push(trimmed);
        }
        break;
      }
      result.push(chunk);
      used += chunk.tokenEstimate;
    }

    return result;
  }

  dispose(): void {
    this.providers.clear();
  }
}
