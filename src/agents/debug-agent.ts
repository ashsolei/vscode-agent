import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på felsökning och debugging. Du hjälper med:
- Analysera felmeddelanden och stack traces
- Identifiera root cause för buggar
- Steg-för-steg debugging-strategier
- Sätta breakpoints och använda debugger
- Logga strategiskt för att hitta problem
- Vanliga fallgropar per språk/ramverk
- Reproducera och isolera buggar
- Race conditions och timing-problem
- Minnesrelaterade fel (segfaults, buffer overflows)
- Nätverks- och API-felsökning

Var systematisk: 1) Förstå symptom, 2) Formulera hypotes, 3) Testa, 4) Fixa, 5) Verifiera.
Svara på samma språk som användaren.`;

/**
 * DebugAgent — specialiserad agent för felsökning.
 */
export class DebugAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('debug', 'Debugagent', 'Felsökning och bugganalys');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Analyserar problem...');

    let additionalContext = '';

    // Hämta diagnostik (fel/varningar) från VS Code
    const diagnostics = vscode.languages.getDiagnostics();
    const errors: string[] = [];

    for (const [uri, diags] of diagnostics) {
      for (const diag of diags) {
        if (diag.severity === vscode.DiagnosticSeverity.Error) {
          const relativePath = vscode.workspace.asRelativePath(uri);
          errors.push(`${relativePath}:${diag.range.start.line + 1}: ${diag.message}`);
        }
      }
    }

    if (errors.length > 0) {
      additionalContext += `\n\nAktuella fel i arbetsytan:\n${errors.slice(0, 15).join('\n')}`;
    }

    // Hämta aktiv fil
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const text = editor.document.getText();
      const lang = editor.document.languageId;
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      additionalContext += `\n\nAktuell fil (${relativePath}):\n\`\`\`${lang}\n${text}\n\`\`\``;
      ctx.stream.reference(editor.document.uri);
    }

    const prompt = additionalContext ? `${PROMPT}\n\nKontext:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Analysera alla fel i arbetsytan', label: 'Alla fel', command: 'debug' },
        { prompt: 'Föreslå debugging-strategi', label: 'Strategi', command: 'debug' },
        { prompt: 'Hjälp mig sätta breakpoints', label: 'Breakpoints', command: 'debug' },
      ],
    };
  }
}
