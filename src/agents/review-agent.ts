import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på kodgranskning (code review). Du hjälper med:
- Granska kodkvalitet, läsbarhet och underhållbarhet
- Hitta buggar, logikfel och edge cases
- Namngivningskonventioner och kodstil
- Felhantering och error boundaries
- API-design och interface-kontrakt
- Arkitekturella problem och koppling (coupling)
- Kodduplicering och abstraktion
- Typkorrekthet och null-säkerhet
- Säkerhetsproblem och injektionsrisker
- Testbarhet och testcoverage

Strukturera din granskning som:
## Sammanfattning
## 🔴 Kritiskt (måste fixas)
## 🟡 Förbättringsförslag
## 🟢 Bra gjort

Var konstruktiv och specifik. Ge konkreta kodexempel på förbättringar.
Svara på samma språk som användaren.`;

/**
 * ReviewAgent — specialiserad agent för kodgranskning.
 */
export class ReviewAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('review', 'Granskningsagent', 'Kodgranskning och kvalitetsanalys');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Granskar kod...');

    let additionalContext = '';

    // Hämta aktiv fil
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const text = editor.document.getText();
      const lang = editor.document.languageId;
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      additionalContext += `\n\nFil: ${relativePath}\n\`\`\`${lang}\n${text}\n\`\`\``;
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

    const prompt = additionalContext ? `${PROMPT}\n\nKod att granska:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Granska felhanteringen i detalj', label: 'Felhantering', command: 'review' },
        { prompt: 'Kontrollera edge cases', label: 'Edge cases', command: 'review' },
        { prompt: 'Granska API-designen', label: 'API-design', command: 'review' },
      ],
    };
  }
}
