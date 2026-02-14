import * as vscode from 'vscode';

/**
 * En ögonblicksbild av en fil innan ändring.
 */
interface FileSnapshot {
  uri: vscode.Uri;
  content: Uint8Array;
  timestamp: number;
}

/**
 * En checkpoint — en samling snapshots från en agent-aktion.
 */
export interface Checkpoint {
  id: string;
  agentId: string;
  description: string;
  snapshots: FileSnapshot[];
  createdFiles: vscode.Uri[];
  timestamp: number;
}

/**
 * GuardRails — skyddssystem för autonoma agenter.
 *
 * Funktioner:
 * - Ta snapshots innan ändringar (automatisk checkpoint)
 * - Rollback/undo till valfri checkpoint
 * - Bekräftelse innan destruktiva åtgärder
 * - Dry-run-läge som visar ändringar utan att applicera
 * - Historik över alla checkpoints
 */
export class GuardRails {
  private checkpoints: Checkpoint[] = [];
  private static readonly MAX_CHECKPOINTS = 50;

  constructor(private stream?: vscode.ChatResponseStream) {}

  // ─────────────────────────────────────────────────────
  //  Checkpoints
  // ─────────────────────────────────────────────────────

  /**
   * Skapa en checkpoint innan en operation.
   * Sparar nuvarande innehåll i alla angivna filer.
   */
  async createCheckpoint(
    agentId: string,
    description: string,
    filePaths: string[]
  ): Promise<Checkpoint> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
      throw new Error('Ingen arbetsyta öppen');
    }

    const snapshots: FileSnapshot[] = [];

    for (const relativePath of filePaths) {
      try {
        const uri = vscode.Uri.joinPath(ws.uri, relativePath);
        const content = await vscode.workspace.fs.readFile(uri);
        snapshots.push({ uri, content, timestamp: Date.now() });
      } catch {
        // Filen existerar inte ännu — det är ok,
        // vi spårar den som "ny fil" nedan
      }
    }

    const checkpoint: Checkpoint = {
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      description,
      snapshots,
      createdFiles: [],
      timestamp: Date.now(),
    };

    this.checkpoints.push(checkpoint);

    // Begränsa antal checkpoints
    if (this.checkpoints.length > GuardRails.MAX_CHECKPOINTS) {
      this.checkpoints.shift();
    }

    this.stream?.progress(`📸 Checkpoint: ${description}`);
    return checkpoint;
  }

  /**
   * Markera filer som skapade av en checkpoint (för rollback-delete).
   */
  markCreated(checkpointId: string, uris: vscode.Uri[]): void {
    const cp = this.checkpoints.find((c) => c.id === checkpointId);
    if (cp) {
      cp.createdFiles.push(...uris);
    }
  }

  // ─────────────────────────────────────────────────────
  //  Rollback
  // ─────────────────────────────────────────────────────

  /**
   * Rollback till en specifik checkpoint.
   * Återställer alla filer till sitt tidigare innehåll
   * och tar bort nyskapade filer.
   */
  async rollback(checkpointId: string): Promise<{
    restoredFiles: number;
    deletedFiles: number;
  }> {
    const cp = this.checkpoints.find((c) => c.id === checkpointId);
    if (!cp) {
      throw new Error(`Checkpoint "${checkpointId}" hittades inte`);
    }

    let restoredFiles = 0;
    let deletedFiles = 0;

    // Återställ snapshots
    for (const snap of cp.snapshots) {
      try {
        await vscode.workspace.fs.writeFile(snap.uri, snap.content);
        restoredFiles++;
      } catch (err) {
        this.stream?.markdown(
          `\n⚠️ Kunde inte återställa fil: ${snap.uri.fsPath} — ${err}\n`
        );
      }
    }

    // Ta bort filer som skapades efter checkpointen
    for (const uri of cp.createdFiles) {
      try {
        await vscode.workspace.fs.delete(uri);
        deletedFiles++;
      } catch (err) {
        this.stream?.markdown(
          `\n⚠️ Kunde inte ta bort fil: ${uri.fsPath} — ${err}\n`
        );
      }
    }

    this.stream?.markdown(
      `\n🔙 **Rollback klar:** ${restoredFiles} filer återställda, ${deletedFiles} nya filer borttagna.\n`
    );

    return { restoredFiles, deletedFiles };
  }

  /**
   * Rollback den senaste checkpointen (undo).
   */
  async undo(): Promise<{
    restoredFiles: number;
    deletedFiles: number;
  } | null> {
    const latest = this.checkpoints[this.checkpoints.length - 1];
    if (!latest) {
      return null;
    }

    const result = await this.rollback(latest.id);
    // Ta bort checkpointen efter rollback
    this.checkpoints.pop();
    return result;
  }

  // ─────────────────────────────────────────────────────
  //  Bekräftelse
  // ─────────────────────────────────────────────────────

  /**
   * Be om bekräftelse innan en destruktiv åtgärd.
   */
  async confirmDestructive(
    action: string,
    details: string[]
  ): Promise<boolean> {
    const detailStr = details.slice(0, 10).join('\n  • ');
    const extra = details.length > 10 ? `\n  ... och ${details.length - 10} till` : '';

    const result = await vscode.window.showWarningMessage(
      `🛡️ Agent vill: ${action}`,
      { modal: true, detail: `  • ${detailStr}${extra}` },
      'Tillåt',
      'Avbryt'
    );

    return result === 'Tillåt';
  }

  // ─────────────────────────────────────────────────────
  //  Dry Run
  // ─────────────────────────────────────────────────────

  /**
   * Visa vad en operation SKULLE göra, utan att utföra den.
   */
  dryRun(
    operations: Array<{
      action: 'create' | 'edit' | 'delete' | 'run';
      target: string;
      detail?: string;
    }>
  ): void {
    if (!this.stream) { return; }

    const icons = { create: '📄', edit: '✏️', delete: '🗑️', run: '🖥️' };

    this.stream.markdown('\n### 🔍 Dry Run — planerade åtgärder\n\n');
    for (const op of operations) {
      this.stream.markdown(
        `${icons[op.action]} **${op.action}** \`${op.target}\`${op.detail ? ` — ${op.detail}` : ''}\n`
      );
    }
    this.stream.markdown('\n*Inga ändringar utfördes.*\n');
  }

  // ─────────────────────────────────────────────────────
  //  Info
  // ─────────────────────────────────────────────────────

  /**
   * Lista alla checkpoints.
   */
  listCheckpoints(): Checkpoint[] {
    return [...this.checkpoints];
  }

  /**
   * Rensa alla checkpoints.
   */
  clearCheckpoints(): void {
    this.checkpoints = [];
  }
}
