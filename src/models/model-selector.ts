import * as vscode from 'vscode';

/**
 * Konfiguration per modell.
 */
export interface ModelConfig {
  /** Modell-familj: gpt-4o, claude, copilot, etc. */
  family: string;
  /** Valfritt: specifik modellversion */
  version?: string;
  /** Max tokens att använda */
  maxTokens?: number;
  /** Temperatur (0.0 – 2.0) */
  temperature?: number;
}

/**
 * Modell-mappning: agentId → ModelConfig.
 * Kan konfigureras i .agentrc.json under "models".
 */
export interface ModelMap {
  /** Standardmodell för alla agenter */
  default: ModelConfig;
  /** Specifik modell per agent */
  agents?: Record<string, ModelConfig>;
  /** Specifik modell per kategori */
  categories?: Record<string, ModelConfig>;
}

/**
 * ModelSelector — väljer rätt språkmodell för varje agent.
 *
 * Stöder:
 * - Default-modell för alla agenter
 * - Specifik modell per agent-ID
 * - Specifik modell per kategori (t.ex. "autonoma" → kraftigare modell)
 * - Fallback till den modell som VS Code Chat redan valt
 * - Cachning av modell-val
 */
export class ModelSelector implements vscode.Disposable {
  private modelMap: ModelMap;
  private modelCache = new Map<string, vscode.LanguageModelChat>();
  private disposables: vscode.Disposable[] = [];

  /** Agent-till-kategori mappning */
  private static CATEGORY_MAP: Record<string, string> = {
    // Grundläggande
    code: 'basic', docs: 'basic', task: 'basic', status: 'basic',
    // Analys
    review: 'analysis', security: 'analysis', perf: 'analysis', debug: 'analysis',
    // Arkitektur
    architect: 'architecture', api: 'architecture',
    // Autonoma
    scaffold: 'autonomous', autofix: 'autonomous', devops: 'autonomous',
    db: 'autonomous', migrate: 'autonomous', component: 'autonomous',
    i18n: 'autonomous', plan: 'autonomous', a11y: 'autonomous',
    docgen: 'autonomous', metrics: 'autonomous', cli: 'autonomous',
    fullstack: 'autonomous',
    // Övriga
    refactor: 'transform', translate: 'transform',
    test: 'testing', explain: 'education', deps: 'dependencies', git: 'git',
  };

  constructor(config?: Partial<ModelMap>) {
    this.modelMap = {
      default: config?.default ?? { family: 'copilot' },
      agents: config?.agents ?? {},
      categories: config?.categories ?? {},
    };
  }

  /**
   * Uppdatera modell-konfigurationen (t.ex. från .agentrc.json).
   */
  updateConfig(config: Partial<ModelMap>): void {
    if (config.default) { this.modelMap.default = config.default; }
    if (config.agents) { this.modelMap.agents = { ...this.modelMap.agents, ...config.agents }; }
    if (config.categories) { this.modelMap.categories = { ...this.modelMap.categories, ...config.categories }; }

    // Rensa cache vid konfigurationsändring
    this.modelCache.clear();
  }

  /**
   * Hämta rätt modell för en agent.
   *
   * Prioriteringskö:
   * 1. Specifik agent-modell (agents.code)
   * 2. Kategori-modell (categories.autonomous)
   * 3. Default-modell
   * 4. Request-modellen (fallback)
   */
  async selectModel(
    agentId: string,
    requestModel: vscode.LanguageModelChat
  ): Promise<vscode.LanguageModelChat> {
    // 1. Kolla om det finns en specifik agent-modell
    const agentConfig = this.modelMap.agents?.[agentId];
    if (agentConfig) {
      const model = await this.findModel(agentConfig);
      if (model) { return model; }
    }

    // 2. Kolla kategori-modell
    const category = ModelSelector.CATEGORY_MAP[agentId];
    if (category) {
      const catConfig = this.modelMap.categories?.[category];
      if (catConfig) {
        const model = await this.findModel(catConfig);
        if (model) { return model; }
      }
    }

    // 3. Default-modell
    if (this.modelMap.default.family !== 'copilot') {
      const model = await this.findModel(this.modelMap.default);
      if (model) { return model; }
    }

    // 4. Fallback: använd request-modellen
    return requestModel;
  }

  /**
   * Hämta model-options (temperatur, max tokens).
   */
  getModelOptions(agentId: string): vscode.LanguageModelChatRequestOptions {
    const agentConfig = this.modelMap.agents?.[agentId];
    const category = ModelSelector.CATEGORY_MAP[agentId];
    const catConfig = category ? this.modelMap.categories?.[category] : undefined;
    const config = agentConfig ?? catConfig ?? this.modelMap.default;

    const options: vscode.LanguageModelChatRequestOptions = {};

    // Notera: VS Code API:et kan ha begränsat stöd för dessa —
    // vi inkluderar dem ändå för framtida kompabilitet
    if (config.maxTokens) {
      (options as any).maxTokens = config.maxTokens;
    }

    return options;
  }

  /**
   * Lista alla tillgängliga modeller i VS Code.
   */
  async listAvailableModels(): Promise<vscode.LanguageModelChat[]> {
    return await vscode.lm.selectChatModels();
  }

  /**
   * Lista modell-konfigurationen (för debugging/dashboard).
   */
  getConfig(): ModelMap {
    return { ...this.modelMap };
  }

  /**
   * Visa modell-info för alla agenter.
   */
  describeModelAssignments(): string {
    const lines: string[] = ['## Modell-konfiguration\n'];

    lines.push(`**Default:** ${this.modelMap.default.family}`);
    lines.push('');

    if (this.modelMap.agents && Object.keys(this.modelMap.agents).length > 0) {
      lines.push('### Per agent:');
      for (const [id, config] of Object.entries(this.modelMap.agents)) {
        lines.push(`- \`${id}\`: ${config.family}${config.version ? ` (${config.version})` : ''}`);
      }
      lines.push('');
    }

    if (this.modelMap.categories && Object.keys(this.modelMap.categories).length > 0) {
      lines.push('### Per kategori:');
      for (const [cat, config] of Object.entries(this.modelMap.categories)) {
        lines.push(`- \`${cat}\`: ${config.family}${config.version ? ` (${config.version})` : ''}`);
      }
    }

    return lines.join('\n');
  }

  // ─── Privata helpers ──────────────────────

  /**
   * Hitta en modell baserat på config.
   */
  private async findModel(config: ModelConfig): Promise<vscode.LanguageModelChat | null> {
    const cacheKey = `${config.family}:${config.version ?? 'latest'}`;

    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey)!;
    }

    try {
      const selector: vscode.LanguageModelChatSelector = {
        family: config.family,
      };

      if (config.version) {
        (selector as any).version = config.version;
      }

      const models = await vscode.lm.selectChatModels(selector);

      if (models.length > 0) {
        this.modelCache.set(cacheKey, models[0]);
        return models[0];
      }
    } catch {
      // Modellen finns inte — fall tillbaka
    }

    return null;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
