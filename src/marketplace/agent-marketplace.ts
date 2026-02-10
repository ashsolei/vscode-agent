import * as vscode from 'vscode';

/**
 * En publicerad agent i marketplace.
 */
export interface MarketplaceAgent {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  icon: string;
  tags: string[];
  downloads: number;
  rating: number;
  ratingCount: number;
  publishedAt: number;
  updatedAt: number;
  /** Plugin-data (full JSON) */
  pluginData: any;
  /** Installationsstatus */
  installed?: boolean;
}

/**
 * Lokalt installerad marketplace-agent.
 */
interface InstalledAgent {
  id: string;
  version: string;
  installedAt: number;
  pluginData: any;
}

const INSTALLED_KEY = 'agent.marketplace.installed';
const RATINGS_KEY = 'agent.marketplace.ratings';
const COMMUNITY_KEY = 'agent.marketplace.community';

export class AgentMarketplace implements vscode.Disposable {
  private installed: Map<string, InstalledAgent> = new Map();
  private community: MarketplaceAgent[] = [];
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly globalState: vscode.Memento,
    private readonly onInstall: (pluginData: any) => void,
    private readonly onUninstall: (agentId: string) => void
  ) {
    this.loadLocal();
    this.loadCommunity();
  }

  /* ─── Data ─── */

  private loadLocal(): void {
    const saved = this.globalState.get<InstalledAgent[]>(INSTALLED_KEY, []);
    for (const a of saved) {
      this.installed.set(a.id, a);
    }
  }

  private async saveLocal(): Promise<void> {
    await this.globalState.update(INSTALLED_KEY, [...this.installed.values()]);
  }

  /** Community-katalog: vi simulerar med lokalt state + inbyggda */
  private loadCommunity(): void {
    // Inbyggda community-agenter som kan importeras
    const builtin: MarketplaceAgent[] = [
      {
        id: 'mkt-regex-helper',
        name: 'Regex Helper',
        description: 'Generera, förklara och testa reguljära uttryck med AI',
        author: 'community',
        version: '1.0.0',
        icon: '🎯',
        tags: ['regex', 'utility', 'string'],
        downloads: 1250,
        rating: 4.7,
        ratingCount: 42,
        publishedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        pluginData: {
          id: 'regex-helper',
          name: 'Regex Helper',
          description: 'Generera, förklara och testa reguljära uttryck med AI',
          systemPrompt: 'Du är en expert på reguljära uttryck. Hjälp användaren att skapa, förklara och testa regex-mönster. Visa alltid: 1) Mönstret, 2) Förklaring av varje del, 3) Testexempel. Stöd alla regex-flavors (JS, Python, Go, etc).',
          examples: ['Skapa en regex för e-postadresser', 'Förklara: ^(?=.*[A-Z])(?=.*\\d).{8,}$'],
        },
      },
      {
        id: 'mkt-sql-wizard',
        name: 'SQL Wizard',
        description: 'Skriv, optimera och förklara SQL-queries',
        author: 'community',
        version: '1.2.0',
        icon: '🧙',
        tags: ['sql', 'database', 'query'],
        downloads: 980,
        rating: 4.5,
        ratingCount: 31,
        publishedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
        pluginData: {
          id: 'sql-wizard',
          name: 'SQL Wizard',
          description: 'SQL-expert som hjälper med komplexa queries, optimering och migration',
          systemPrompt: 'Du är en SQL-expert. Skriv optimerade queries, förklara execution plans, och hjälp med databasdesign. Stöd PostgreSQL, MySQL, SQLite och MSSQL. Optimera alltid för prestanda.',
          examples: ['Skriv en CTE för hierarkisk data', 'Optimera denna JOIN-query'],
        },
      },
      {
        id: 'mkt-color-palette',
        name: 'Color Palette Generator',
        description: 'Generera färgpaletter, konvertera färger, kontrollera kontrast',
        author: 'community',
        version: '1.0.0',
        icon: '🎨',
        tags: ['design', 'css', 'color', 'accessibility'],
        downloads: 750,
        rating: 4.8,
        ratingCount: 28,
        publishedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        pluginData: {
          id: 'color-palette',
          name: 'Color Palette Generator',
          description: 'Generera färgpaletter, kontrollera kontrast, konvertera mellan format',
          systemPrompt: 'Du är en design-expert för färger. Generera harmoniska paletter (complementary, analogous, triadic), konvertera mellan HEX/RGB/HSL, och kontrollera WCAG-kontrast. Visa alltid CSS-variabler.',
          examples: ['Skapa en blå-baserad palett', 'Kontrollera kontrasten mellan #333 och #f0f0f0'],
        },
      },
      {
        id: 'mkt-commit-writer',
        name: 'Commit Message Writer',
        description: 'AI-genererade commit-meddelanden baserat på git diff',
        author: 'community',
        version: '2.0.0',
        icon: '✍️',
        tags: ['git', 'commit', 'conventional'],
        downloads: 2100,
        rating: 4.9,
        ratingCount: 85,
        publishedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
        pluginData: {
          id: 'commit-writer',
          name: 'Commit Message Writer',
          description: 'Generera konventionella commit-meddelanden baserat på ändringar',
          systemPrompt: 'Du analyserar git diffs och genererar commit-meddelanden enligt Conventional Commits (feat, fix, refactor, docs, chore, etc). Inkludera scope om möjligt. Max 72 tecken för subject line. Lägg till body om ändringen är komplex.',
          examples: ['Skriv commit för mina ändringar', 'Generera release notes'],
        },
      },
      {
        id: 'mkt-env-manager',
        name: 'Env Manager',
        description: 'Hantera .env-filer, validera variabler, generera typedefs',
        author: 'community',
        version: '1.1.0',
        icon: '🔐',
        tags: ['env', 'config', 'security', 'dotenv'],
        downloads: 560,
        rating: 4.3,
        ratingCount: 19,
        publishedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        pluginData: {
          id: 'env-manager',
          name: 'Env Manager',
          description: 'Hantera .env-filer, generera TypeScript-typningar, validera',
          systemPrompt: 'Du hjälper med .env-filer och miljövariabler. Generera .env.example, TypeScript-typnings (process.env), Zod-validering, och Docker-kompatibla env-filer. Varna för känsliga värden som publiceras.',
          examples: ['Generera .env.example från min .env', 'Skapa Zod-schema för mina env-variabler'],
        },
      },
    ];

    // Hämta community-data från state (simulated)
    const custom = this.globalState.get<MarketplaceAgent[]>(COMMUNITY_KEY, []);
    this.community = [...builtin, ...custom];
  }

  /* ─── Browse & Search ─── */

  /** Lista alla tillgängliga agenter */
  browse(options?: { tag?: string; sort?: 'downloads' | 'rating' | 'recent' }): MarketplaceAgent[] {
    let result = [...this.community].map((a) => ({
      ...a,
      installed: this.installed.has(a.pluginData?.id ?? a.id),
    }));

    if (options?.tag) {
      result = result.filter((a) => a.tags.includes(options.tag!));
    }

    switch (options?.sort) {
      case 'downloads':
        result.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'recent':
        result.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      default:
        result.sort((a, b) => b.downloads - a.downloads);
    }

    return result;
  }

  /** Sök */
  search(query: string): MarketplaceAgent[] {
    const q = query.toLowerCase();
    return this.browse().filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  /* ─── Install / Uninstall ─── */

  /** Installera agent från marketplace */
  async install(marketplaceId: string): Promise<boolean> {
    const agent = this.community.find((a) => a.id === marketplaceId);
    if (!agent) {
      vscode.window.showErrorMessage('Agent hittades inte i marketplace.');
      return false;
    }

    const pluginId = agent.pluginData?.id ?? agent.id;

    // Spara plugin-JSON till .agent-plugins/
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const pluginDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.agent-plugins');
      await vscode.workspace.fs.createDirectory(pluginDir);
      const pluginFile = vscode.Uri.joinPath(pluginDir, `${pluginId}.json`);
      await vscode.workspace.fs.writeFile(
        pluginFile,
        Buffer.from(JSON.stringify(agent.pluginData, null, 2), 'utf-8')
      );
    }

    // Registrera i installerade
    this.installed.set(pluginId, {
      id: pluginId,
      version: agent.version,
      installedAt: Date.now(),
      pluginData: agent.pluginData,
    });
    await this.saveLocal();

    // Notifiera extensionen
    this.onInstall(agent.pluginData);

    // Bumpa downloads
    agent.downloads++;

    vscode.window.showInformationMessage(
      `✅ ${agent.icon} ${agent.name} installerad! Använd /${pluginId} i chatten.`
    );
    return true;
  }

  /** Avinstallera */
  async uninstall(pluginId: string): Promise<boolean> {
    if (!this.installed.has(pluginId)) { return false; }

    // Ta bort från .agent-plugins/
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const pluginFile = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        '.agent-plugins',
        `${pluginId}.json`
      );
      try {
        await vscode.workspace.fs.delete(pluginFile);
      } catch {
        // Filen kanske redan saknas
      }
    }

    this.installed.delete(pluginId);
    await this.saveLocal();
    this.onUninstall(pluginId);

    vscode.window.showInformationMessage(`❌ Agent "${pluginId}" avinstallerad.`);
    return true;
  }

  /* ─── Publish ─── */

  /** Publicera en lokal plugin till community */
  async publish(pluginData: any): Promise<boolean> {
    if (!pluginData?.id || !pluginData?.name) {
      vscode.window.showErrorMessage('Plugin saknar id/name.');
      return false;
    }

    const author = await vscode.window.showInputBox({
      prompt: 'Ditt namn (author)',
      placeHolder: 'anonymous',
    }) ?? 'anonymous';

    const tags = await vscode.window.showInputBox({
      prompt: 'Taggar (kommaseparerade)',
      placeHolder: 'utility, code, helper',
    });

    const marketplaceAgent: MarketplaceAgent = {
      id: `mkt-${pluginData.id}`,
      name: pluginData.name,
      description: pluginData.description ?? '',
      author,
      version: '1.0.0',
      icon: '🔌',
      tags: tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? [],
      downloads: 0,
      rating: 0,
      ratingCount: 0,
      publishedAt: Date.now(),
      updatedAt: Date.now(),
      pluginData,
    };

    this.community.push(marketplaceAgent);
    // Spara community lokalt (simulerad)
    const custom = this.globalState.get<MarketplaceAgent[]>(COMMUNITY_KEY, []);
    custom.push(marketplaceAgent);
    await this.globalState.update(COMMUNITY_KEY, custom);

    vscode.window.showInformationMessage(
      `📦 "${pluginData.name}" publicerad i marketplace!`
    );
    return true;
  }

  /** Betygsätt en agent */
  async rate(marketplaceId: string): Promise<void> {
    const agent = this.community.find((a) => a.id === marketplaceId);
    if (!agent) { return; }

    const pick = await vscode.window.showQuickPick(
      ['⭐⭐⭐⭐⭐ (5)', '⭐⭐⭐⭐ (4)', '⭐⭐⭐ (3)', '⭐⭐ (2)', '⭐ (1)'],
      { title: `Betygsätt ${agent.name}` }
    );
    if (!pick) { return; }

    const value = parseInt(pick.match(/\((\d)\)/)?.[1] ?? '5');
    // Enkel running average
    const total = agent.rating * agent.ratingCount + value;
    agent.ratingCount++;
    agent.rating = Math.round((total / agent.ratingCount) * 10) / 10;

    // Spara ratings
    const ratings = this.globalState.get<Record<string, number>>(RATINGS_KEY, {});
    ratings[marketplaceId] = value;
    await this.globalState.update(RATINGS_KEY, ratings);

    vscode.window.showInformationMessage(
      `Betyg sparat: ${agent.name} — ${agent.rating} ⭐ (${agent.ratingCount} betyg)`
    );
  }

  /* ─── UI: QuickPick ─── */

  async showBrowser(): Promise<void> {
    const agents = this.browse();

    const items: (vscode.QuickPickItem & { mktId?: string; action?: string })[] = [
      ...agents.map((a) => ({
        label: `${a.installed ? '✅ ' : ''}${a.icon} ${a.name}`,
        description: `v${a.version} by ${a.author} | ⬇${a.downloads} ⭐${a.rating}`,
        detail: `${a.description}\nTaggar: ${a.tags.join(', ')}`,
        mktId: a.id,
      })),
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(cloud-upload) Publicera lokal plugin...', action: 'publish' },
      { label: '$(search) Sök...', action: 'search' },
    ];

    const pick = await vscode.window.showQuickPick(items, {
      title: '🏪 Agent Marketplace',
      placeHolder: 'Bläddra bland community-agenter...',
      matchOnDetail: true,
    });

    if (!pick) { return; }

    if (pick.action === 'publish') {
      await this.publishFromFile();
    } else if (pick.action === 'search') {
      const query = await vscode.window.showInputBox({ prompt: 'Sökord' });
      if (query) {
        const results = this.search(query);
        if (results.length === 0) {
          vscode.window.showInformationMessage('Inga träffar.');
        } else {
          await this.showAgentDetail(results[0].id);
        }
      }
    } else if (pick.mktId) {
      await this.showAgentDetail(pick.mktId);
    }
  }

  /** Visa detaljer + installera/avinstallera */
  private async showAgentDetail(marketplaceId: string): Promise<void> {
    const agent = this.community.find((a) => a.id === marketplaceId);
    if (!agent) { return; }

    const isInstalled = this.installed.has(agent.pluginData?.id ?? agent.id);
    const actions = isInstalled
      ? ['Avinstallera', 'Betygsätt', 'Visa källa']
      : ['Installera', 'Betygsätt', 'Visa källa'];

    const choice = await vscode.window.showInformationMessage(
      `${agent.icon} ${agent.name} v${agent.version}\n\n` +
        `${agent.description}\n\n` +
        `⬇ ${agent.downloads} | ⭐ ${agent.rating} (${agent.ratingCount}) | av ${agent.author}`,
      ...actions
    );

    switch (choice) {
      case 'Installera':
        await this.install(marketplaceId);
        break;
      case 'Avinstallera':
        await this.uninstall(agent.pluginData?.id ?? agent.id);
        break;
      case 'Betygsätt':
        await this.rate(marketplaceId);
        break;
      case 'Visa k\u00e4lla': {
        const doc = await vscode.workspace.openTextDocument({
          content: JSON.stringify(agent.pluginData, null, 2),
          language: 'json',
        });
        await vscode.window.showTextDocument(doc);
        break;
      }
    }
  }

  /** Publicera befintlig plugin-fil */
  private async publishFromFile(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      filters: { JSON: ['json'] },
      canSelectMany: false,
      title: 'Välj plugin-fil att publicera',
    });
    if (!uris || uris.length === 0) { return; }

    const content = await vscode.workspace.fs.readFile(uris[0]);
    try {
      const pluginData = JSON.parse(Buffer.from(content).toString('utf-8'));
      await this.publish(pluginData);
    } catch {
      vscode.window.showErrorMessage('Ogiltigt plugin-format.');
    }
  }

  /** Installerade agenter */
  listInstalled(): InstalledAgent[] {
    return [...this.installed.values()];
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
