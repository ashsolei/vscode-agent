import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { SYSTEM_PROMPTS } from '../prompts';
import { ToolRegistry } from '../tools';

/**
 * CodeAgent — specialiserad agent för kodanalys och generering.
 * Har tillgång till filverktyg och sökverktyg för att ge kontextuella svar.
 */
export class CodeAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('code', 'Kodagent', 'Analyserar och genererar kod');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Analyserar kodfråga...');

    // Samla kontext från öppna editorer och referenser
    let additionalContext = '';

    // Kolla om det finns fil-referenser i requesten
    if (ctx.request.references.length > 0) {
      for (const ref of ctx.request.references) {
        if (ref.value instanceof vscode.Uri) {
          const result = await this.tools.execute(
            'file',
            { action: 'read', path: vscode.workspace.asRelativePath(ref.value) },
            ctx.token
          );
          if (result.success) {
            additionalContext += `\n\n--- Fil: ${vscode.workspace.asRelativePath(ref.value)} ---\n${result.data}`;
            ctx.stream.reference(ref.value);
          }
        }
      }
    }

    // Kolla aktiv editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && !additionalContext) {
      const selection = activeEditor.selection;
      const selectedText = activeEditor.document.getText(
        selection.isEmpty ? undefined : selection
      );
      if (selectedText) {
        const relativePath = vscode.workspace.asRelativePath(activeEditor.document.uri);
        additionalContext += `\n\n--- Aktuell fil: ${relativePath} ---\n${selectedText}`;
        ctx.stream.reference(activeEditor.document.uri);
      }
    }

    const prompt = additionalContext
      ? `${SYSTEM_PROMPTS.code}\n\nKontext:\n${additionalContext}`
      : SYSTEM_PROMPTS.code;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Kan du förklara koden mer i detalj?', label: 'Förklara mer' },
        { prompt: 'Kan du refaktorera koden?', label: 'Refaktorera' },
        { prompt: 'Finns det buggar i koden?', label: 'Hitta buggar' },
      ],
    };
  }
}
