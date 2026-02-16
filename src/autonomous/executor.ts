import * as vscode from 'vscode';
import type { DiffPreview } from '../diff/diff-preview';

/**
 * Resultat från en autonom åtgärd.
 */
export interface ActionResult {
  action: string;
  success: boolean;
  detail: string;
  filesAffected?: string[];
}

/**
 * AutonomousExecutor — ramverk för agenter som utför faktiska ändringar.
 *
 * Ger agenter möjlighet att:
 * - Skapa och redigera filer
 * - Köra terminalkommandon
 * - Analysera hela arbetsytan
 * - Skapa flera filer i en sekvens (scaffolding)
 * - Rapportera framsteg i realtid via ChatResponseStream
 * - Förhandsgranska ändringar via DiffPreview (om tillgängligt)
 */
export class AutonomousExecutor {
  private actionLog: ActionResult[] = [];
  private stepCount = 0;
  private readonly maxSteps: number;

  /**
   * @param stream ChatResponseStream för progress-rapportering
   * @param diffPreview Om satt, samlas ändringar för förhandsgranskning istället för direkt skrivning
   * @param maxSteps Maximalt antal muterande åtgärder (default: 10)
   */
  constructor(
    private stream: vscode.ChatResponseStream,
    private diffPreview?: DiffPreview,
    maxSteps?: number
  ) {
    this.maxSteps = maxSteps
      ?? vscode.workspace.getConfiguration('vscodeAgent.autonomous').get<number>('maxSteps', 10);
  }

  /**
   * Kontrollera om max antal steg har uppnåtts.
   * Kastar fel om gränsen är nådd.
   */
  private guardStep(action: string): void {
    if (this.stepCount >= this.maxSteps) {
      throw new Error(
        `Max antal åtgärder (${this.maxSteps}) uppnått. Avbryter "${action}". ` +
        `Öka gränsen via inställningen vscodeAgent.autonomous.maxSteps.`
      );
    }
    this.stepCount++;
    this.stream.progress(`📊 Steg ${this.stepCount}/${this.maxSteps}`);
  }

  /** Antal muterande steg som utförts */
  get steps(): number {
    return this.stepCount;
  }

  /**
   * Validera att en relativ sökväg inte leder utanför arbetsytan.
   * Avvisar sökvägar med '..' som pekar utanför roten.
   */
  private validatePath(relativePath: string, ws: vscode.WorkspaceFolder): vscode.Uri {
    // Defense-in-depth: reject paths containing '..' segments
    const segments = relativePath.split('/');
    if (segments.some(s => s === '..')) {
      throw new Error(`Sökvägen '${relativePath}' pekar utanför arbetsytan`);
    }
    const uri = vscode.Uri.joinPath(ws.uri, relativePath);
    const resolved = uri.fsPath;
    const root = ws.uri.fsPath;
    // Ensure the resolved path is within the workspace root
    if (!resolved.startsWith(root + '/') && resolved !== root) {
      throw new Error(`Sökvägen '${relativePath}' pekar utanför arbetsytan`);
    }
    return uri;
  }

  /** Hämta logg över alla utförda åtgärder */
  get log(): ActionResult[] {
    return [...this.actionLog];
  }

  /**
   * Skapa en ny fil i arbetsytan.
   * Om DiffPreview är aktivt samlas ändringen för förhandsgranskning.
   */
  async createFile(relativePath: string, content: string): Promise<ActionResult> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
      return this.record('createFile', false, 'Ingen arbetsyta öppen');
    }

    try {
      this.guardStep('createFile');
      this.validatePath(relativePath, ws);

      if (this.diffPreview) {
        this.diffPreview.addDiff({
          path: relativePath,
          type: 'create',
          proposed: content,
        });
        this.stream.progress(`📋 Förhandsgranskad: ${relativePath} (ny fil)`);
        return this.record('createFile', true, `Förhandsgranskad: ${relativePath}`, [relativePath]);
      }

      const uri = this.validatePath(relativePath, ws);
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
      this.stream.progress(`✅ Skapade ${relativePath}`);
      return this.record('createFile', true, `Skapade ${relativePath}`, [relativePath]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Okänt fel';
      return this.record('createFile', false, `Misslyckades skapa ${relativePath}: ${msg}`);
    }
  }

  /**
   * Läs en fil från arbetsytan.
   */
  async readFile(relativePath: string): Promise<string | null> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return null; }

    try {
      const uri = this.validatePath(relativePath, ws);
      const content = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder().decode(content);
    } catch {
      return null;
    }
  }

  /**
   * Kontrollera om en fil existerar.
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return false; }

    try {
      const uri = this.validatePath(relativePath, ws);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lista filer i en katalog.
   */
  async listDir(relativePath: string = ''): Promise<Array<{ name: string; isDir: boolean }>> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return []; }

    try {
      const uri = relativePath
        ? this.validatePath(relativePath, ws)
        : ws.uri;
      const entries = await vscode.workspace.fs.readDirectory(uri);
      return entries.map(([name, type]) => ({
        name,
        isDir: type === vscode.FileType.Directory,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Sök efter filer med glob-mönster.
   */
  async findFiles(pattern: string, maxResults = 100): Promise<string[]> {
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', maxResults);
    return files.map(f => vscode.workspace.asRelativePath(f));
  }

  /**
   * Hämta alla diagnostik (fel/varningar) i arbetsytan.
   */
  getDiagnostics(severity?: vscode.DiagnosticSeverity): Array<{
    file: string;
    line: number;
    message: string;
    severity: string;
  }> {
    const allDiags = vscode.languages.getDiagnostics();
    const results: Array<{ file: string; line: number; message: string; severity: string }> = [];

    for (const [uri, diags] of allDiags) {
      for (const d of diags) {
        if (severity !== undefined && d.severity !== severity) { continue; }
        results.push({
          file: vscode.workspace.asRelativePath(uri),
          line: d.range.start.line + 1,
          message: d.message,
          severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error'
            : d.severity === vscode.DiagnosticSeverity.Warning ? 'warning'
            : 'info',
        });
      }
    }

    return results;
  }

  /**
   * Öppna en fil i editorn.
   */
  async openFile(relativePath: string): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return; }

    const uri = this.validatePath(relativePath, ws);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  /**
   * Applicera en textredigering på en befintlig fil.
   * Om DiffPreview är aktivt samlas ändringen för förhandsgranskning.
   * @param replaceAll Om true, ersätts alla förekomster av searchText (default: false).
   */
  async editFile(
    relativePath: string,
    searchText: string,
    replaceText: string,
    replaceAll = false
  ): Promise<ActionResult> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
      return this.record('editFile', false, 'Ingen arbetsyta öppen');
    }

    try {
      this.guardStep('editFile');
      const uri = this.validatePath(relativePath, ws);
      const content = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder().decode(content);

      if (!text.includes(searchText)) {
        return this.record('editFile', false, `Hittade inte texten i ${relativePath}`);
      }

      const newText = replaceAll
        ? text.replaceAll(searchText, replaceText)
        : text.replace(searchText, replaceText);

      if (this.diffPreview) {
        this.diffPreview.addDiff({
          path: relativePath,
          type: 'modify',
          original: text,
          proposed: newText,
        });
        this.stream.progress(`📋 Förhandsgranskad: ${relativePath} (redigering)`);
        return this.record('editFile', true, `Förhandsgranskad: ${relativePath}`, [relativePath]);
      }

      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(newText));
      this.stream.progress(`✏️ Redigerade ${relativePath}`);
      return this.record('editFile', true, `Redigerade ${relativePath}`, [relativePath]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Okänt fel';
      return this.record('editFile', false, `Misslyckades redigera ${relativePath}: ${msg}`);
    }
  }

  /**
   * Skapa flera filer på en gång (scaffolding).
   * Om en fil misslyckas rullas alla redan skapade filer tillbaka.
   */
  async createFiles(files: Array<{ path: string; content: string }>): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    const createdPaths: string[] = [];

    for (const file of files) {
      const result = await this.createFile(file.path, file.content);
      results.push(result);

      if (result.success) {
        createdPaths.push(file.path);
      } else {
        // Rulla tillbaka alla redan skapade filer
        if (createdPaths.length > 0 && !this.diffPreview) {
          const ws = vscode.workspace.workspaceFolders?.[0];
          if (ws) {
            for (const created of createdPaths) {
              try {
                const uri = this.validatePath(created, ws);
                await vscode.workspace.fs.delete(uri);
              } catch { /* best-effort rollback */ }
            }
            this.stream.progress(`⚠️ Rollback: tog bort ${createdPaths.length} filer efter fel i ${file.path}`);
          }
        }
        // Markera kvarvarande filer som överhoppade
        for (let i = results.length; i < files.length; i++) {
          results.push(this.record('createFile', false, `Överhoppad (rollback): ${files[i].path}`));
        }
        break;
      }
    }

    return results;
  }

  /**
   * Ta bort en fil.
   * Om DiffPreview är aktivt samlas ändringen för förhandsgranskning.
   */
  async deleteFile(relativePath: string): Promise<ActionResult> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
      return this.record('deleteFile', false, 'Ingen arbetsyta öppen');
    }

    try {
      this.guardStep('deleteFile');
      const uri = this.validatePath(relativePath, ws);

      if (this.diffPreview) {
        // Läs originalinnehåll för diff-vy
        let original: string | undefined;
        try {
          const content = await vscode.workspace.fs.readFile(uri);
          original = new TextDecoder().decode(content);
        } catch { /* filen kanske inte finns */ }

        this.diffPreview.addDiff({
          path: relativePath,
          type: 'delete',
          original,
        });
        this.stream.progress(`📋 Förhandsgranskad: ${relativePath} (borttagning)`);
        return this.record('deleteFile', true, `Förhandsgranskad: ${relativePath}`, [relativePath]);
      }

      await vscode.workspace.fs.delete(uri);
      this.stream.progress(`🗑️ Tog bort ${relativePath}`);
      return this.record('deleteFile', true, `Tog bort ${relativePath}`, [relativePath]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Okänt fel';
      return this.record('deleteFile', false, `Misslyckades ta bort ${relativePath}: ${msg}`);
    }
  }

  /**
   * Rapportera slutresultat som markdown.
   */
  reportSummary(): void {
    const successful = this.actionLog.filter(a => a.success).length;
    const failed = this.actionLog.filter(a => !a.success).length;

    let md = `\n\n---\n### 🤖 Autonomt resultat\n`;
    md += `**${successful}** åtgärder lyckades`;
    if (failed > 0) {
      md += `, **${failed}** misslyckades`;
    }
    md += '\n\n';

    const allFiles = this.actionLog
      .flatMap(a => a.filesAffected ?? [])
      .filter((f, i, arr) => arr.indexOf(f) === i);

    if (allFiles.length > 0) {
      md += '**Filer som påverkades:**\n';
      for (const f of allFiles) {
        md += `- 📄 \`${f}\`\n`;
      }
    }

    this.stream.markdown(md);
  }

  // ─────────────────────────────────────────────────────
  //  🖥️ TERMINALEXEKVERING — kör kommandon i VS Code-terminalen
  // ─────────────────────────────────────────────────────

  /**
   * Kör ett terminalkommando och vänta på att det slutförs.
   * Returnerar exit-kod (0 = lyckat).
   */
  async runCommand(
    command: string,
    options?: { cwd?: string; name?: string; timeout?: number }
  ): Promise<ActionResult> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    // Validate cwd is within workspace if specified
    let cwd: vscode.Uri;
    if (options?.cwd) {
      const cwdUri = vscode.Uri.file(options.cwd);
      if (ws && !cwdUri.fsPath.startsWith(ws.uri.fsPath + '/') && cwdUri.fsPath !== ws.uri.fsPath) {
        return this.record('runCommand', false, `cwd '${options.cwd}' pekar utanför arbetsytan`);
      }
      cwd = cwdUri;
    } else if (ws) {
      cwd = ws.uri;
    } else {
      return this.record('runCommand', false, 'Ingen arbetsyta öppen');
    }

    const termName = options?.name ?? `Agent: ${command.slice(0, 30)}`;
    const timeout = options?.timeout ?? 60_000; // default 60s

    try {
      this.guardStep('runCommand');
      this.stream.progress(`🖥️ Kör: ${command}`);

      // Skapa en ShellExecution-task
      const taskDef: vscode.TaskDefinition = { type: 'agent-exec' };
      const execution = new vscode.ShellExecution(command, { cwd: cwd.fsPath });
      const task = new vscode.Task(
        taskDef,
        vscode.TaskScope.Workspace,
        termName,
        'agent',
        execution
      );
      task.presentationOptions = {
        reveal: vscode.TaskRevealKind.Silent,
        panel: vscode.TaskPanelKind.Dedicated,
        clear: true,
      };

      // Kör tasken och vänta på avslut
      const exitCode = await new Promise<number | undefined>((resolve, reject) => {
        const disposables: vscode.Disposable[] = [];

        const timer = setTimeout(() => {
          for (const d of disposables) { d.dispose(); }
          reject(new Error(`Timeout (${timeout}ms): ${command}`));
        }, timeout);

        disposables.push(
          vscode.tasks.onDidEndTaskProcess((e) => {
            if (e.execution.task === task) {
              clearTimeout(timer);
              for (const d of disposables) { d.dispose(); }
              resolve(e.exitCode);
            }
          })
        );

        vscode.tasks.executeTask(task).then(undefined, (err) => {
          clearTimeout(timer);
          for (const d of disposables) { d.dispose(); }
          reject(err);
        });
      });

      if (exitCode === 0) {
        this.stream.progress(`✅ Kommando lyckades: ${command}`);
        return this.record('runCommand', true, `Kommando "${command}" avslutades med kod 0`);
      } else {
        return this.record('runCommand', false, `Kommando "${command}" avslutades med kod ${exitCode}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Okänt fel';
      return this.record('runCommand', false, `Kommando "${command}" misslyckades: ${msg}`);
    }
  }

  /**
   * Kör flera kommandon i sekvens. Avbryter vid första fel om stopOnError = true.
   */
  async runCommands(
    commands: string[],
    options?: { cwd?: string; stopOnError?: boolean }
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    for (const cmd of commands) {
      const result = await this.runCommand(cmd, { cwd: options?.cwd });
      results.push(result);
      if (!result.success && options?.stopOnError !== false) {
        this.stream.progress(`⛔ Avbryter kedja efter misslyckat kommando: ${cmd}`);
        break;
      }
    }
    return results;
  }

  /**
   * Kör npm/yarn/pnpm install.
   */
  async installDependencies(
    packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
  ): Promise<ActionResult> {
    return this.runCommand(`${packageManager} install`);
  }

  /**
   * Kör npm/yarn/pnpm run <script>.
   */
  async runScript(
    script: string,
    packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
  ): Promise<ActionResult> {
    return this.runCommand(`${packageManager} run ${script}`);
  }

  private record(action: string, success: boolean, detail: string, filesAffected?: string[]): ActionResult {
    const result = { action, success, detail, filesAffected };
    this.actionLog.push(result);
    return result;
  }

  /**
   * Läs och parsa en JSON-fil.
   * Returnerar null om filen inte finns eller inte kan parsas.
   */
  async readJsonFile<T = unknown>(relativePath: string): Promise<T | null> {
    const content = await this.readFile(relativePath);
    if (!content) { return null; }
    try {
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Rensa åtgärdsloggen (t.ex. mellan iterationer).
   */
  clearLog(): void {
    this.actionLog.length = 0;
  }
}
