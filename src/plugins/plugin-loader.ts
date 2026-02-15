import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';
import { AutonomousExecutor } from '../autonomous/executor';

// ───────────────────────────────────────────────────
//  📦 Plugin Agent — wrapper för dynamiska plugin-agenter
// ───────────────────────────────────────────────────

/**
 * JSON-schema för en plugin-definition (.agent-plugins/*.json).
 */
export interface PluginDefinition {
  /** Unikt ID (slug) */
  id: string;
  /** Visningsnamn */
  name: string;
  /** Beskrivning */
  description: string;
  /** System-prompt som styr agentens beteende */
  systemPrompt: string;
  /** Ikon (VS Code ThemeIcon-namn) */
  icon?: string;
  /** Autonoma capabilities */
  autonomous?: boolean;
  /** Vilken modell agenten föredrar (se ModelSelector) */
  preferredModel?: string;
  /** Taggar för kategorisering */
  tags?: string[];
  /** Agenter att delegera till automatiskt */
  delegates?: string[];
  /** Template-variabler: {{workspaceRoot}}, {{language}}, etc. */
  variables?: Record<string, string>;
}

/**
 * En dynamiskt skapad agent baserad på en plugin-definition.
 */
class PluginAgent extends BaseAgent {
  private definition: PluginDefinition;

  constructor(def: PluginDefinition) {
    super(def.id, def.name, def.description);
    this.definition = def;
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, `🔌 ${this.name} (plugin-agent)`);

    // Ersätt template-variabler i system-prompten
    let systemPrompt = this.definition.systemPrompt;
    const ws = vscode.workspace.workspaceFolders?.[0];

    // Inbyggda variabler
    const builtinVars: Record<string, string> = {
      '{{workspaceRoot}}': ws?.uri.fsPath ?? '.',
      '{{workspaceName}}': ws?.name ?? 'unknown',
      '{{language}}': vscode.env.language,
      '{{date}}': new Date().toISOString().split('T')[0],
    };

    // Användardefinierade variabler (builtins vinner vid override)
    const allVars = { ...(this.definition.variables ?? {}), ...builtinVars };

    for (const [key, value] of Object.entries(allVars)) {
      systemPrompt = systemPrompt.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    // Om autonom, ge tillgång till executor
    if (this.definition.autonomous) {
      const executor = new AutonomousExecutor(ctx.stream);
      const prompt = `${systemPrompt}

Du har tillgång till följande autonoma kapabiliteter:
- Skapa filer
- Redigera filer
- Köra terminalkommandon
- Lista kataloger

Utför uppgiften och rapportera vad du gjort.`;

      await this.chat(ctx, prompt);

      executor.reportSummary();
      return { metadata: { plugin: this.definition.id, autonomous: true } };
    }

    // Delegera till andra agenter om konfigurerat
    if (this.definition.delegates?.length) {
      for (const delegateId of this.definition.delegates) {
        ctx.stream.markdown(`\n---\n🔗 Delegerar till \`${delegateId}\`...\n`);
        await this.delegateTo(delegateId, ctx);
      }
      return { metadata: { plugin: this.definition.id, delegated: true } };
    }

    // Standard: chatta med LLM
    await this.chat(ctx, systemPrompt);

    return { metadata: { plugin: this.definition.id } };
  }
}

// ───────────────────────────────────────────────────
//  🔄 Plugin Loader — hot-reload av plugin-agenter
// ───────────────────────────────────────────────────

/**
 * PluginLoader — laddar, validerar och vakar plugin-definitioner
 * från .agent-plugins/ i arbetsytan.
 */
export class PluginLoader implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private loadedPlugins = new Map<string, PluginAgent>();
  private onPluginsChanged = new vscode.EventEmitter<PluginAgent[]>();

  /** Event som triggas när plugins ändras */
  readonly onDidChangePlugins = this.onPluginsChanged.event;

  constructor(
    private registerCallback: (agent: PluginAgent) => void,
    private unregisterCallback: (agentId: string) => void
  ) {}

  /**
   * Skanna och ladda alla plugins, starta bevakning.
   */
  async activate(): Promise<PluginAgent[]> {
    const plugins = await this.scanAndLoad();

    // Skapa FileSystemWatcher för .agent-plugins/*.json
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/.agent-plugins/*.json'
    );

    watcher.onDidCreate((uri) => this.handleFileChange(uri, 'created'));
    watcher.onDidChange((uri) => this.handleFileChange(uri, 'changed'));
    watcher.onDidDelete((uri) => this.handleFileDelete(uri));

    this.watchers.push(watcher);
    return plugins;
  }

  /**
   * Skanna .agent-plugins/ och ladda alla giltiga plugins.
   */
  async scanAndLoad(): Promise<PluginAgent[]> {
    const files = await vscode.workspace.findFiles(
      '.agent-plugins/*.json',
      '**/node_modules/**'
    );

    const plugins: PluginAgent[] = [];

    for (const file of files) {
      const agent = await this.loadPlugin(file);
      if (agent) {
        plugins.push(agent);
      }
    }

    return plugins;
  }

  /**
   * Ladda en enskild plugin-fil.
   */
  private async loadPlugin(uri: vscode.Uri): Promise<PluginAgent | null> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const json = JSON.parse(new TextDecoder().decode(content)) as PluginDefinition;

      // Validera obligatoriska fält
      if (!json.id || !json.name || !json.systemPrompt) {
        vscode.window.showWarningMessage(
          `Plugin ${uri.fsPath}: saknar obligatoriska fält (id, name, systemPrompt)`
        );
        return null;
      }

      // Prefix ID för att undvika kollisioner med inbyggda agenter
      const pluginId = `plugin-${json.id}`;
      json.id = pluginId;

      const agent = new PluginAgent(json);

      // Om redan laddat, avregistrera först
      if (this.loadedPlugins.has(pluginId)) {
        this.unregisterCallback(pluginId);
      }

      this.loadedPlugins.set(pluginId, agent);
      this.registerCallback(agent);

      return agent;
    } catch (err) {
      vscode.window.showWarningMessage(
        `Kunde inte ladda plugin ${uri.fsPath}: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  /**
   * Hantera fil-ändringar (create/modify).
   */
  private async handleFileChange(uri: vscode.Uri, _type: string): Promise<void> {
    const agent = await this.loadPlugin(uri);
    if (agent) {
      vscode.window.showInformationMessage(
        `🔌 Plugin "${agent.name}" laddades om`
      );
      this.onPluginsChanged.fire(Array.from(this.loadedPlugins.values()));
    }
  }

  /**
   * Hantera fil-borttagning.
   */
  private handleFileDelete(uri: vscode.Uri): void {
    // Försök hitta vilken plugin som togs bort
    const filename = uri.path.split('/').pop()?.replace('.json', '') ?? '';
    const pluginId = `plugin-${filename}`;

    if (this.loadedPlugins.has(pluginId)) {
      this.unregisterCallback(pluginId);
      this.loadedPlugins.delete(pluginId);
      vscode.window.showInformationMessage(
        `🔌 Plugin "${pluginId}" avregistrerades`
      );
      this.onPluginsChanged.fire(Array.from(this.loadedPlugins.values()));
    }
  }

  /**
   * Lista alla laddade plugin-agenter.
   */
  listPlugins(): PluginAgent[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Skapa en ny plugin-fil (boilerplate).
   */
  async createPlugin(id: string, name: string): Promise<vscode.Uri | null> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return null; }

    const definition: PluginDefinition = {
      id,
      name,
      description: `Custom agent: ${name}`,
      systemPrompt: `Du är en specialiserad AI-agent som heter "${name}".
Du hjälper användaren med specifika uppgifter.

Instruktioner:
- Svara tydligt och koncist
- Ge kodexempel när det är lämpligt  
- Arbetsyta: {{workspaceRoot}}
- Datum: {{date}}`,
      icon: 'zap',
      autonomous: false,
      tags: ['custom'],
    };

    const uri = vscode.Uri.joinPath(ws.uri, '.agent-plugins', `${id}.json`);
    await vscode.workspace.fs.writeFile(
      uri,
      new TextEncoder().encode(JSON.stringify(definition, null, 2))
    );

    return uri;
  }

  dispose(): void {
    for (const w of this.watchers) {
      w.dispose();
    }
    this.onPluginsChanged.dispose();
  }
}

export { PluginAgent };
