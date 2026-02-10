import * as vscode from 'vscode';

/**
 * Projektspecifik agentkonfiguration (.agentrc.json).
 *
 * Exempel:
 * ```json
 * {
 *   "defaultAgent": "code",
 *   "language": "sv",
 *   "autoRouter": true,
 *   "disabledAgents": ["fullstack"],
 *   "workflows": {
 *     "ci": {
 *       "steps": ["test", "security", "perf"]
 *     }
 *   },
 *   "eventRules": [
 *     { "event": "onSave", "filePattern": "**\/*.ts", "agentId": "autofix" }
 *   ],
 *   "memory": { "enabled": true, "maxAge": 604800000 },
 *   "guardrails": { "confirmDestructive": true, "dryRunDefault": false },
 *   "prompts": {
 *     "code": "Du är en senior TypeScript-utvecklare. Använd strikt typer."
 *   }
 * }
 * ```
 */
export interface AgentConfig {
  /** Standard-agent utan slash-kommando */
  defaultAgent?: string;
  /** Språk för agentsvar */
  language?: string;
  /** Aktivera smart auto-router */
  autoRouter?: boolean;
  /** Inaktiverade agenter */
  disabledAgents?: string[];
  /** Custom workflows */
  workflows?: Record<string, {
    description?: string;
    steps: Array<{
      agentId: string;
      prompt?: string;
      pipeOutput?: boolean;
    }>;
  }>;
  /** Event-regler */
  eventRules?: Array<{
    event: string;
    filePattern?: string;
    agentId: string;
    prompt?: string;
    enabled?: boolean;
  }>;
  /** Minnesinställningar */
  memory?: {
    enabled?: boolean;
    maxAge?: number;
    maxCount?: number;
  };
  /** Guard rails */
  guardrails?: {
    confirmDestructive?: boolean;
    dryRunDefault?: boolean;
  };
  /** Custom system-prompts per agent */
  prompts?: Record<string, string>;
}

/**
 * ConfigManager — laddar och hanterar projektconfig.
 */
export class ConfigManager {
  private static readonly CONFIG_FILE = '.agentrc.json';
  private config: AgentConfig = {};
  private watcher: vscode.FileSystemWatcher | undefined;
  private _onDidChange = new vscode.EventEmitter<AgentConfig>();
  public readonly onDidChange = this._onDidChange.event;

  constructor() {
    this.load();
    this.setupWatcher();
  }

  /**
   * Hämta nuvarande config.
   */
  get current(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Hämta ett specifikt värde.
   */
  get<K extends keyof AgentConfig>(key: K): AgentConfig[K] {
    return this.config[key];
  }

  /**
   * Hämta custom prompt för en agent.
   */
  getPrompt(agentId: string): string | undefined {
    return this.config.prompts?.[agentId];
  }

  /**
   * Kontrollera om en agent är inaktiverad.
   */
  isDisabled(agentId: string): boolean {
    return this.config.disabledAgents?.includes(agentId) ?? false;
  }

  /**
   * Ladda config från .agentrc.json.
   */
  private async load(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return; }

    try {
      const uri = vscode.Uri.joinPath(ws.uri, ConfigManager.CONFIG_FILE);
      const content = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder().decode(content);
      this.config = JSON.parse(text);
      this._onDidChange.fire(this.config);
    } catch {
      // Ingen config-fil — allt standard
      this.config = {};
    }
  }

  /**
   * Skapa en standard .agentrc.json i projektet.
   */
  async createDefault(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return; }

    const defaultConfig: AgentConfig = {
      defaultAgent: 'code',
      language: 'sv',
      autoRouter: true,
      disabledAgents: [],
      memory: { enabled: true, maxAge: 2_592_000_000 },
      guardrails: { confirmDestructive: true, dryRunDefault: false },
      prompts: {},
    };

    const uri = vscode.Uri.joinPath(ws.uri, ConfigManager.CONFIG_FILE);
    const content = JSON.stringify(defaultConfig, null, 2);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));

    vscode.window.showInformationMessage(`Skapade ${ConfigManager.CONFIG_FILE}`);
    this.config = defaultConfig;
    this._onDidChange.fire(this.config);
  }

  /**
   * Övervaka config-filen för live-ändringar.
   */
  private setupWatcher(): void {
    this.watcher = vscode.workspace.createFileSystemWatcher(
      `**/${ConfigManager.CONFIG_FILE}`
    );

    this.watcher.onDidChange(() => this.load());
    this.watcher.onDidCreate(() => this.load());
    this.watcher.onDidDelete(() => {
      this.config = {};
      this._onDidChange.fire(this.config);
    });
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidChange.dispose();
  }
}
