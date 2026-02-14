import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AgentRegistry } from './index';

/**
 * HealthAgent — systemdiagnostik och hälsokontroll av agentsystemet.
 * Visar registrerade agenter, minnesanvändning, arbetsyta och uptid.
 */
export class HealthAgent extends BaseAgent {
  constructor(private registry: AgentRegistry) {
    super('health', 'Hälsokontrollagent', 'Systemdiagnostik och hälsokontroll av agentsystemet');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Kör hälsokontroll...');

    // Samla diagnostikdata
    const agents = this.registry.list();
    const totalAgents = agents.length;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceStatus = workspaceFolders
      ? `✅ ${workspaceFolders.length} ${workspaceFolders.length === 1 ? 'arbetsyta' : 'arbetsytor'}`
      : '❌ Ingen arbetsyta öppen';
    const extensionCount = vscode.extensions.all.length;
    const memoryUsage = process.memoryUsage().heapUsed;
    const memoryMB = (memoryUsage / 1024 / 1024).toFixed(1);
    const uptime = process.uptime();
    const uptimeMin = (uptime / 60).toFixed(1);

    // Bygg markdown-rapport
    let markdown = '## 🏥 Hälsokontroll\n\n';
    markdown += '### Systemöversikt\n\n';
    markdown += '| Egenskap | Värde |\n|----------|-------|\n';
    markdown += `| Registrerade agenter | ${totalAgents} |\n`;
    markdown += `| Arbetsyta | ${workspaceStatus} |\n`;
    markdown += `| Aktiva tillägg | ${extensionCount} |\n`;
    markdown += `| Minnesanvändning (heap) | ${memoryMB} MB |\n`;
    markdown += `| Uptid | ${uptimeMin} min |\n`;

    // Lista alla registrerade agenter
    markdown += '\n### Registrerade agenter\n\n';
    markdown += '| ID | Namn | Beskrivning |\n|----|------|-------------|\n';
    for (const agent of agents) {
      markdown += `| \`${agent.id}\` | ${agent.name} | ${agent.description} |\n`;
    }

    ctx.stream.markdown(markdown);

    return {};
  }
}
