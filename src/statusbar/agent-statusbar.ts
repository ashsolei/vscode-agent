import * as vscode from 'vscode';

/**
 * AgentStatusBar — visar agent-information i VS Code statusfältet.
 *
 * Visar:
 * - Aktiv agent + ikon
 * - Antal körda agenter / senaste agent
 * - Minnesanvändning (antal sparade minnen)
 * - Klickbar: öppna dashboard
 */
export class AgentStatusBar implements vscode.Disposable {
  private mainItem: vscode.StatusBarItem;
  private memoryItem: vscode.StatusBarItem;
  private pluginItem: vscode.StatusBarItem;

  private activeAgent: string | null = null;
  private totalRuns = 0;
  private errors = 0;
  private lastAgent = '';

  constructor() {
    // Huvudstatus — vänster sida, hög prioritet
    this.mainItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.mainItem.command = 'vscode-agent.showDashboard';
    this.mainItem.tooltip = 'Öppna Agent Dashboard';
    this.mainItem.show();

    // Minnesindikator — vänster sida
    this.memoryItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    this.memoryItem.command = 'vscode-agent.showMemory';
    this.memoryItem.tooltip = 'Visa agentminne';
    this.memoryItem.show();

    // Plugin-räknare — vänster sida
    this.pluginItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98
    );
    this.pluginItem.command = 'vscode-agent.createPlugin';
    this.pluginItem.tooltip = 'Agent Plugins (klicka för att skapa ny)';
    this.pluginItem.show();

    // Initial rendering
    this.render();
  }

  /**
   * Markera att en agent startade körning.
   */
  setActive(agentId: string, agentName: string): void {
    this.activeAgent = agentName;
    this.lastAgent = agentName;
    this.totalRuns++;
    this.render();
  }

  /**
   * Markera att agenten är klar.
   */
  setIdle(success: boolean = true): void {
    this.activeAgent = null;
    if (!success) { this.errors++; }
    this.render();
  }

  /**
   * Uppdatera minnesräknare.
   */
  updateMemory(count: number): void {
    this.memoryItem.text = `$(database) ${count}`;
    this.memoryItem.tooltip = `${count} sparade minnen — klicka för att visa`;
  }

  /**
   * Uppdatera plugin-räknare.
   */
  updatePlugins(count: number): void {
    this.pluginItem.text = `$(plug) ${count}`;
    this.pluginItem.tooltip = `${count} plugins laddade — klicka för att skapa ny`;
  }

  /**
   * Rendera statusfältet.
   */
  private render(): void {
    if (this.activeAgent) {
      // Aktiv — animerad spinner
      this.mainItem.text = `$(loading~spin) ${this.activeAgent}`;
      this.mainItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
      this.mainItem.tooltip = `Agent "${this.activeAgent}" kör...`;
    } else if (this.totalRuns === 0) {
      // Inget kört än
      this.mainItem.text = '$(hubot) Agent redo';
      this.mainItem.backgroundColor = undefined;
      this.mainItem.tooltip = 'VS Code Agent — klicka för dashboard';
    } else {
      // Idle med statistik
      const errorSuffix = this.errors > 0 ? ` | ${this.errors} fel` : '';
      this.mainItem.text = `$(hubot) ${this.totalRuns} körningar${errorSuffix}`;
      this.mainItem.backgroundColor = this.errors > 0
        ? new vscode.ThemeColor('statusBarItem.errorBackground')
        : undefined;
      this.mainItem.tooltip = `Senast: ${this.lastAgent} | Totalt: ${this.totalRuns} körningar${errorSuffix}\nKlicka för dashboard`;
    }
  }

  /**
   * Hämta statistik.
   */
  getStats(): { totalRuns: number; errors: number; lastAgent: string } {
    return {
      totalRuns: this.totalRuns,
      errors: this.errors,
      lastAgent: this.lastAgent,
    };
  }

  dispose(): void {
    this.mainItem.dispose();
    this.memoryItem.dispose();
    this.pluginItem.dispose();
  }
}
