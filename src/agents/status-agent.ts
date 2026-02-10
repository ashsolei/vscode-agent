import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { SharedState } from '../state';

/**
 * StatusAgent — visar agentens aktuella tillstånd och konfiguration.
 * Användbar för att se vad som delas mellan VS Code-fönster.
 */
export class StatusAgent extends BaseAgent {
  constructor(private state: SharedState) {
    super('status', 'Statusagent', 'Visar agentens tillstånd och konfiguration');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Hämtar status...');

    const allState = this.state.getAll();
    const stateEntries = Object.entries(allState);

    let markdown = '## 🔄 Agent Status\n\n';
    markdown += `**Fönster-ID:** \`${this.state.windowId}\`\n\n`;
    markdown += `**Aktiva agenter:** code, docs, task, status\n\n`;

    if (stateEntries.length > 0) {
      markdown += '### Delat tillstånd\n\n';
      markdown += '| Nyckel | Värde |\n|--------|-------|\n';

      for (const [key, value] of stateEntries) {
        const displayValue = typeof value === 'object'
          ? JSON.stringify(value).slice(0, 80)
          : String(value).slice(0, 80);
        markdown += `| \`${key}\` | ${displayValue} |\n`;
      }
    } else {
      markdown += '*Inget delat tillstånd sparas just nu.*\n';
    }

    // Visa arbetsyteinformation
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      markdown += '\n### Arbetsytor\n\n';
      for (const folder of workspaceFolders) {
        markdown += `- 📁 ${folder.name} — \`${folder.uri.fsPath}\`\n`;
      }
    }

    ctx.stream.markdown(markdown);

    this.button(ctx, 'Rensa tillstånd', 'vscode-agent.clearState');

    return {};
  }
}
