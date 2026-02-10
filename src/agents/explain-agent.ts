import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { SharedState } from '../state';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på kodförklaring och en tålmodig lärare. Du hjälper med:
- Förklara komplex kod steg för steg
- Förklara algoritmer och datastrukturer
- Förklara designmönster och deras syfte
- Visualisera kodflöde och dataflöde
- Förklara koncept anpassat till användarens nivå
- Ge analogier och verklighetsnära exempel
- Förklara typ-system och generics
- Bryta ner svåra koncept i enklare delar
- Förklara ramverks-magi (vad händer under huven)
- Skapa läroplaner och studieplaner

Anpassa förklaringsnivån baserat på frågan.
Använd kodexempel och diagram när det hjälper.
Svara på samma språk som användaren.`;

/**
 * ExplainAgent — specialiserad agent för att förklara och lära ut.
 * Sparar lärhistorik i delat tillstånd för fortsatt lärande.
 */
export class ExplainAgent extends BaseAgent {
  constructor(
    private tools: ToolRegistry,
    private state: SharedState
  ) {
    super('explain', 'Förklaringsagent', 'Förklara kod och koncept pedagogiskt');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Förbereder förklaring...');

    let additionalContext = '';

    // Hämta aktiv fil
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selection = editor.selection;
      const text = editor.document.getText(selection.isEmpty ? undefined : selection);
      const lang = editor.document.languageId;
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      additionalContext += `\n\nKod att förklara (${relativePath}):\n\`\`\`${lang}\n${text}\n\`\`\``;
      ctx.stream.reference(editor.document.uri);
    }

    // Hämta fil-referenser
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

    // Lägg till lärhistorik
    const learnHistory = this.state.get<string[]>('learnTopics') ?? [];
    if (learnHistory.length > 0) {
      additionalContext += `\n\nTidigare förklarade ämnen: ${learnHistory.join(', ')}`;
    }

    const prompt = additionalContext ? `${PROMPT}\n\nKontext:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    // Spara ämnet i lärhistorik
    const topic = ctx.request.prompt.slice(0, 60);
    learnHistory.push(topic);
    this.state.set('learnTopics', learnHistory.slice(-20)); // Behåll senaste 20

    return {
      followUps: [
        { prompt: 'Förklara det enklare, som för en nybörjare', label: 'Enklare', command: 'explain' },
        { prompt: 'Gå djupare och mer tekniskt', label: 'Djupare', command: 'explain' },
        { prompt: 'Ge mig en övning för att testa min förståelse', label: 'Övning', command: 'explain' },
      ],
    };
  }
}
