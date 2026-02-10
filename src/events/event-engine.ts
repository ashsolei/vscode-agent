import * as vscode from 'vscode';
import { AgentRegistry } from '../agents/index';

/**
 * Regel som ett event matchas mot.
 */
export interface EventRule {
  id: string;
  /** Typ av event */
  event: 'onSave' | 'onDiagnostics' | 'onFileCreate' | 'onFileDelete' | 'onInterval';
  /** Glob-mönster för filnamn (gäller onSave, onFileCreate, onFileDelete) */
  filePattern?: string;
  /** Lägsta allvarlighetsgrad (gäller onDiagnostics): 'error' | 'warning' */
  minSeverity?: 'error' | 'warning';
  /** Intervall i ms (gäller onInterval) */
  intervalMs?: number;
  /** Agent som ska triggas */
  agentId: string;
  /** Prompt att skicka till agenten */
  prompt: string;
  /** Aktiv? */
  enabled: boolean;
  /** Cooldown i ms (undvik spam). Default: 10s */
  cooldownMs?: number;
}

/**
 * EventDrivenEngine — triggar agenter automatiskt baserat på VS Code-events.
 *
 * Stöder:
 * - onSave — agent körs när en fil sparas (med glob-filter)
 * - onDiagnostics — agent körs när nya fel/varningar dyker upp
 * - onFileCreate — agent körs när en ny fil skapas
 * - onFileDelete — agent körs när en fil tas bort
 * - onInterval — agent körs på intervall (t.ex. var 5 min)
 */
export class EventDrivenEngine {
  private rules: EventRule[] = [];
  private disposables: vscode.Disposable[] = [];
  private intervals: ReturnType<typeof setInterval>[] = [];
  private lastTrigger = new Map<string, number>();
  private outputChannel: vscode.OutputChannel;

  constructor(
    private registry: AgentRegistry,
    private globalState: vscode.Memento
  ) {
    this.outputChannel = vscode.window.createOutputChannel('Agent Events');
    this.loadRules();
  }

  // ─────────────────────────────────────────────────────
  //  Regel-hantering
  // ─────────────────────────────────────────────────────

  /**
   * Lägg till en event-regel.
   */
  addRule(rule: EventRule): void {
    this.rules.push(rule);
    this.persistRules();
    this.log(`Lade till regel: ${rule.id} (${rule.event} → ${rule.agentId})`);
  }

  /**
   * Ta bort en regel.
   */
  removeRule(ruleId: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    this.persistRules();
    return before > this.rules.length;
  }

  /**
   * Aktivera/inaktivera en regel.
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.persistRules();
    }
  }

  /**
   * Lista alla regler.
   */
  listRules(): EventRule[] {
    return [...this.rules];
  }

  // ─────────────────────────────────────────────────────
  //  Aktivering — börja lyssna
  // ─────────────────────────────────────────────────────

  /**
   * Aktivera event-lyssnare baserat på registrerade regler.
   */
  activate(): void {
    // onSave
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        const matchingRules = this.rules.filter(
          (r) => r.enabled && r.event === 'onSave' && this.matchFile(doc.uri, r.filePattern)
        );
        for (const rule of matchingRules) {
          this.triggerRule(rule, { file: doc.uri.fsPath });
        }
      })
    );

    // onDiagnostics
    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics((e) => {
        const diagRules = this.rules.filter(
          (r) => r.enabled && r.event === 'onDiagnostics'
        );
        if (diagRules.length === 0) { return; }

        for (const uri of e.uris) {
          const diags = vscode.languages.getDiagnostics(uri);
          for (const rule of diagRules) {
            const minSev = rule.minSeverity === 'error'
              ? vscode.DiagnosticSeverity.Error
              : vscode.DiagnosticSeverity.Warning;

            const matching = diags.filter((d) => d.severity <= minSev);
            if (matching.length > 0) {
              this.triggerRule(rule, {
                file: uri.fsPath,
                errorCount: matching.length,
                firstError: matching[0].message,
              });
            }
          }
        }
      })
    );

    // onFileCreate
    const createWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    this.disposables.push(createWatcher);

    createWatcher.onDidCreate((uri) => {
      const matchingRules = this.rules.filter(
        (r) => r.enabled && r.event === 'onFileCreate' && this.matchFile(uri, r.filePattern)
      );
      for (const rule of matchingRules) {
        this.triggerRule(rule, { file: uri.fsPath });
      }
    });

    createWatcher.onDidDelete((uri) => {
      const matchingRules = this.rules.filter(
        (r) => r.enabled && r.event === 'onFileDelete' && this.matchFile(uri, r.filePattern)
      );
      for (const rule of matchingRules) {
        this.triggerRule(rule, { file: uri.fsPath });
      }
    });

    // onInterval
    const intervalRules = this.rules.filter(
      (r) => r.enabled && r.event === 'onInterval' && r.intervalMs
    );
    for (const rule of intervalRules) {
      const interval = setInterval(() => {
        if (rule.enabled) {
          this.triggerRule(rule, {});
        }
      }, rule.intervalMs!);
      this.intervals.push(interval);
    }

    this.log(`Aktiverad med ${this.rules.filter((r) => r.enabled).length} aktiva regler.`);
  }

  // ─────────────────────────────────────────────────────
  //  Triggering
  // ─────────────────────────────────────────────────────

  private triggerRule(rule: EventRule, context: Record<string, unknown>): void {
    // Cooldown-check
    const cooldown = rule.cooldownMs ?? 10_000;
    const last = this.lastTrigger.get(rule.id) ?? 0;
    if (Date.now() - last < cooldown) {
      return; // Fortfarande i cooldown
    }
    this.lastTrigger.set(rule.id, Date.now());

    const agent = this.registry.get(rule.agentId);
    if (!agent) {
      this.log(`⚠️ Agent "${rule.agentId}" finns inte (regel: ${rule.id})`);
      return;
    }

    // Expandera prompt med kontextvariabler
    let prompt = rule.prompt;
    for (const [key, val] of Object.entries(context)) {
      prompt = prompt.replace(`\${${key}}`, String(val));
    }

    this.log(`🔔 Triggade regel "${rule.id}" → ${agent.name}: ${prompt.slice(0, 80)}`);

    // Visa notifiering
    vscode.window.showInformationMessage(
      `🤖 Agent "${agent.name}" triggad: ${rule.event}`,
      'Visa logg'
    ).then((choice) => {
      if (choice === 'Visa logg') {
        this.outputChannel.show();
      }
    });
  }

  // ─────────────────────────────────────────────────────
  //  Hjälpare
  // ─────────────────────────────────────────────────────

  private matchFile(uri: vscode.Uri, pattern?: string): boolean {
    if (!pattern) { return true; }
    // Enkel glob-matchning
    const fileName = uri.fsPath;
    if (pattern.startsWith('**/*.')) {
      const ext = pattern.slice(4);
      return fileName.endsWith(ext);
    }
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      return fileName.endsWith(ext);
    }
    return fileName.includes(pattern);
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toISOString().slice(11, 23)}] ${message}`);
  }

  private loadRules(): void {
    const stored = this.globalState.get<EventRule[]>('eventRules');
    if (stored) {
      this.rules = stored;
    }
  }

  private persistRules(): void {
    this.globalState.update('eventRules', this.rules);
  }

  // ─────────────────────────────────────────────────────
  //  Fördefinierade regler
  // ─────────────────────────────────────────────────────

  /** Rule: autofix TypeScript-fel vid save */
  static autoFixOnSave(): EventRule {
    return {
      id: 'autofix-on-save',
      event: 'onSave',
      filePattern: '**/*.ts',
      agentId: 'autofix',
      prompt: 'Fixa alla TypeScript-fel i filen ${file}',
      enabled: false,
      cooldownMs: 15_000,
    };
  }

  /** Rule: kör säkerhetsanalys vid ny fil */
  static securityOnNewFile(): EventRule {
    return {
      id: 'security-new-file',
      event: 'onFileCreate',
      filePattern: '**/*.ts',
      agentId: 'security',
      prompt: 'Analysera säkerheten i den nya filen ${file}',
      enabled: false,
      cooldownMs: 30_000,
    };
  }

  /** Rule: generera dokumentation vid diagnostik-varningar */
  static docsOnErrors(): EventRule {
    return {
      id: 'docs-on-errors',
      event: 'onDiagnostics',
      minSeverity: 'error',
      agentId: 'explain',
      prompt: 'Förklara felet: ${firstError} i ${file}',
      enabled: false,
      cooldownMs: 20_000,
    };
  }

  dispose(): void {
    for (const d of this.disposables) { d.dispose(); }
    for (const i of this.intervals) { clearInterval(i); }
    this.outputChannel.dispose();
  }
}
