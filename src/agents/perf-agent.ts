import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på prestandaoptimering. Du hjälper med:
- Identifiera flaskhalsar och prestandaproblem
- Algoritmisk komplexitet (Big-O-analys)
- Minnesoptimering och minnesläckor
- Databasoptimering (index, frågeoptimering, N+1)
- Frontend-prestanda (bundle size, lazy loading, caching)
- Backend-prestanda (connection pooling, async, caching)
- Profileringsverktyg och benchmarking
- Concurrency och parallellism
- CDN, komprimering och nätverksoptimering
- Renderingsprestanda (virtualisering, memoization, debounce)

Ange alltid förväntad prestandaförbättring när möjligt (t.ex. "O(n²) → O(n log n)").
Svara på samma språk som användaren.`;

/**
 * PerfAgent — specialiserad agent för prestandaanalys och optimering.
 */
export class PerfAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('perf', 'Prestandaagent', 'Prestandaanalys och optimering');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Analyserar prestanda...');

    let additionalContext = '';

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selection = editor.selection;
      const text = editor.document.getText(selection.isEmpty ? undefined : selection);
      const lang = editor.document.languageId;
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      additionalContext += `\n\nFil: ${relativePath} (${lang})\n\`\`\`${lang}\n${text}\n\`\`\``;
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

    const prompt = additionalContext ? `${PROMPT}\n\nKod att analysera:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Analysera algoritmisk komplexitet', label: 'Big-O', command: 'perf' },
        { prompt: 'Hitta minnesläckor', label: 'Minne', command: 'perf' },
        { prompt: 'Optimera databasfrågor', label: 'Databas', command: 'perf' },
      ],
    };
  }
}
