import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på testning och kvalitetssäkring. Du hjälper med:
- Skriva enhetstester (unit tests) för given kod
- Skriva integrationstester
- Skriva end-to-end-tester
- Testdriven utveckling (TDD) — skriva tester före implementation
- Hitta luckor i testcoverage
- Välja rätt testramverk (Jest, Mocha, Pytest, JUnit, etc.)
- Skriva mocks, stubs och fixtures
- Parametriserade och tabell-drivna tester
- Testmönster: Arrange-Act-Assert, Given-When-Then

Generera alltid körbar testkod med tydliga testnamn som beskriver beteendet.
Svara på samma språk som användaren.`;

/**
 * TestAgent — specialiserad agent för testgenerering och teststrategier.
 */
export class TestAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('test', 'Testagent', 'Generera tester och teststrategier');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Förbereder tester...');

    let additionalContext = '';

    // Hämta aktiv fil som kontext
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const text = editor.document.getText();
      const lang = editor.document.languageId;
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      additionalContext += `\n\nKod att testa (${relativePath}):\n\`\`\`${lang}\n${text}\n\`\`\``;
      ctx.stream.reference(editor.document.uri);
    }

    // Sök efter befintliga tester i projektet
    const testFiles = await this.tools.execute(
      'file',
      { action: 'search', pattern: '**/*.{test,spec}.{ts,js,tsx,jsx,py}' },
      ctx.token
    );
    if (testFiles.success && Array.isArray(testFiles.data) && (testFiles.data as string[]).length > 0) {
      additionalContext += `\n\nBefintliga testfiler: ${(testFiles.data as string[]).slice(0, 8).join(', ')}`;
    }

    // Sök efter testkonfiguration
    const configFiles = await this.tools.execute(
      'file',
      { action: 'search', pattern: '**/{jest,vitest,.mocharc,pytest,karma}.config.{ts,js,json,ini}' },
      ctx.token
    );
    if (configFiles.success && Array.isArray(configFiles.data) && (configFiles.data as string[]).length > 0) {
      additionalContext += `\n\nTestkonfiguration: ${(configFiles.data as string[]).join(', ')}`;
    }

    const prompt = additionalContext ? `${PROMPT}\n\nProjektkontext:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Skapa enhetstester för alla publika metoder', label: 'Unit tests', command: 'test' },
        { prompt: 'Generera edge case-tester', label: 'Edge cases', command: 'test' },
        { prompt: 'Skriv mocks för externa beroenden', label: 'Mocks', command: 'test' },
      ],
    };
  }
}
