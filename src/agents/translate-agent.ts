import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på att konvertera och översätta kod mellan programmeringsspråk. Du hjälper med:
- Översätta kod från ett språk till ett annat (t.ex. Python → TypeScript)
- Migrera mellan ramverk (React → Vue, Express → Fastify, etc.)
- Konvertera kodparadigm (OOP → funktionellt, callbacks → async/await)
- Uppgradera kod till nyare versioner av språk/ramverk
- Konvertera konfigurationsformat (JSON ↔ YAML ↔ TOML)
- Migrera databaser (SQL ↔ NoSQL)
- Konvertera REST API till GraphQL (eller tvärtom)
- Anpassa kod för kompatibilitet (CommonJS ↔ ESM)

Bevara alltid samma beteende och funktionalitet.
Kommentera eventuella skillnader i idiom mellan språken.
Svara på samma språk som användaren.`;

/**
 * TranslateAgent — specialiserad agent för kodöversättning mellan språk.
 */
export class TranslateAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('translate', 'Översättningsagent', 'Översätt kod mellan språk och ramverk');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Översätter kod...');

    let additionalContext = '';

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selection = editor.selection;
      const text = editor.document.getText(selection.isEmpty ? undefined : selection);
      const lang = editor.document.languageId;
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      additionalContext += `\n\nKällkod (${lang}, ${relativePath}):\n\`\`\`${lang}\n${text}\n\`\`\``;
      ctx.stream.reference(editor.document.uri);
    }

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

    const prompt = additionalContext ? `${PROMPT}\n\nKod att översätta:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Översätt till Python', label: '→ Python', command: 'translate' },
        { prompt: 'Översätt till TypeScript', label: '→ TypeScript', command: 'translate' },
        { prompt: 'Konvertera till funktionell stil', label: '→ Funktionellt', command: 'translate' },
      ],
    };
  }
}
