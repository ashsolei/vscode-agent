import * as vscode from 'vscode';
import { BaseAgent } from '../agents/base-agent';
import { AgentRegistry } from '../agents/index';

/**
 * TreeItem för en agent i sidopanelen.
 */
class AgentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly agent: BaseAgent,
    public readonly usageCount: number
  ) {
    super(agent.name, vscode.TreeItemCollapsibleState.None);
    this.id = `agent-${agent.id}`;
    this.description = `${usageCount} anrop`;
    this.tooltip = new vscode.MarkdownString(
      `**${agent.name}** (\`/${agent.id}\`)\n\n${agent.description}\n\n---\n📊 ${usageCount} anrop`
    );
    this.iconPath = this.getIcon(agent.id);
    this.contextValue = 'agent';

    // Klick → öppna chatten med agentens kommando
    this.command = {
      command: 'workbench.action.chat.open',
      title: `Använd ${agent.name}`,
      arguments: [{ query: `@agent /${agent.id} ` }],
    };
  }

  private getIcon(agentId: string): vscode.ThemeIcon {
    const iconMap: Record<string, string> = {
      code: 'code',
      docs: 'book',
      task: 'checklist',
      status: 'dashboard',
      refactor: 'wrench',
      review: 'eye',
      test: 'beaker',
      debug: 'bug',
      security: 'shield',
      perf: 'flame',
      architect: 'layers',
      api: 'globe',
      translate: 'symbol-string',
      deps: 'package',
      explain: 'mortar-board',
      git: 'git-merge',
      scaffold: 'new-folder',
      autofix: 'lightbulb-autofix',
      devops: 'server-process',
      db: 'database',
      migrate: 'arrow-swap',
      component: 'symbol-class',
      i18n: 'symbol-string',
      plan: 'note',
      a11y: 'accessibility',
      docgen: 'file-text',
      metrics: 'graph',
      cli: 'terminal',
      fullstack: 'rocket',
    };

    return new vscode.ThemeIcon(iconMap[agentId] ?? 'hubot');
  }
}

/**
 * Kategori-nod i trädvyn.
 */
class CategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly agents: AgentTreeItem[],
    public readonly icon: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${agents.length} agenter`;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.contextValue = 'category';
  }
}

type TreeNode = CategoryTreeItem | AgentTreeItem;

/**
 * AgentTreeProvider — visar alla agenter i VS Code:s sidopanel.
 */
export class AgentTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private categories: Map<string, string[]> = new Map([
    ['Grundläggande', ['code', 'docs', 'task', 'status']],
    ['Kodkvalitet', ['refactor', 'review', 'test', 'debug']],
    ['Prestanda & Säkerhet', ['security', 'perf']],
    ['Arkitektur', ['architect', 'api']],
    ['Verktyg', ['translate', 'deps', 'explain', 'git']],
    ['Autonoma', ['scaffold', 'autofix', 'devops', 'db', 'migrate', 'component', 'i18n', 'plan', 'a11y', 'docgen', 'metrics', 'cli', 'fullstack']],
  ]);

  constructor(
    private registry: AgentRegistry,
    private globalState: vscode.Memento
  ) {}

  /**
   * Uppdatera trädvyn.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      // Rot — visa kategorier
      const stats = this.globalState.get<Record<string, number>>('agentUsageStats') ?? {};
      const result: CategoryTreeItem[] = [];

      for (const [catName, agentIds] of this.categories) {
        const agentItems: AgentTreeItem[] = [];
        for (const id of agentIds) {
          const agent = this.registry.get(id);
          if (agent) {
            agentItems.push(new AgentTreeItem(agent, stats[id] ?? 0));
          }
        }
        if (agentItems.length > 0) {
          const icons: Record<string, string> = {
            'Grundläggande': 'home',
            'Kodkvalitet': 'inspect',
            'Prestanda & Säkerhet': 'shield',
            'Arkitektur': 'layers',
            'Verktyg': 'tools',
            'Autonoma': 'hubot',
          };
          result.push(new CategoryTreeItem(catName, agentItems, icons[catName] ?? 'folder'));
        }
      }

      return result;
    }

    if (element instanceof CategoryTreeItem) {
      return element.agents;
    }

    return [];
  }
}
