import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på kodrefaktorering. Du hjälper med:
- Identifiera kodlukter (code smells) och teknisk skuld
- Applicera designmönster (Strategy, Observer, Factory, etc.)
- Extrahera metoder, klasser och moduler
- Förenkla komplex logik och minska cyklomatisk komplexitet
- Namngivning och kodstruktur
- DRY (Don't Repeat Yourself) och SOLID-principerna
- Migrera äldre kod till moderna mönster

Ge alltid ett "före" och "efter"-exempel. Förklara varför ändringen förbättrar koden.
Svara på samma språk som användaren.`;

/**
 * RefactorAgent — specialiserad agent för kodrefaktorering.
 * Analyserar befintlig kod och föreslår strukturella förbättringar.
 */
export class RefactorAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('refactor', 'Refaktoreringsagent', 'Refaktorera och förbättra kodstruktur');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Analyserar kodstruktur...');

    let additionalContext = '';

    // Hämta aktiv editors kod
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selection = editor.selection;
      const text = editor.document.getText(selection.isEmpty ? undefined : selection);
      const lang = editor.document.languageId;
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      additionalContext += `\n\nFil: ${relativePath} (${lang})\n\`\`\`${lang}\n${text}\n\`\`\``;
      ctx.stream.reference(editor.document.uri);
    }

    // Kolla fil-referenser
    for (const ref of ctx.request.references) {
      if (ref.value instanceof vscode.Uri) {
        const result = await this.tools.execute(
          'file',
          { action: 'read', path: vscode.workspace.asRelativePath(ref.value) },
          ctx.token
        );
        if (result.success) {
          additionalContext += `\n\n--- ${vscode.workspace.asRelativePath(ref.value)} ---\n${result.data}`;
          ctx.stream.reference(ref.value);
        }
      }
    }

    const prompt = additionalContext
      ? `${PROMPT}\n\nKod att analysera:${additionalContext}`
      : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Extrahera metoder ur koden', label: 'Extrahera metoder', command: 'refactor' },
        { prompt: 'Applicera SOLID-principer', label: 'SOLID', command: 'refactor' },
        { prompt: 'Förenkla koden', label: 'Förenkla', command: 'refactor' },
      ],
    };
  }
}
