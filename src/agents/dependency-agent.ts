import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på beroendehantering och paketekosystem. Du hjälper med:
- Analysera och uppdatera beroenden (npm, pip, cargo, go mod, etc.)
- Hitta sårbara, föråldade eller onödiga beroenden
- Lösa versionskonflikter och peer dependency-problem
- Jämföra alternativa paket (bundle size, popularitet, underhåll)
- Migrera mellan paketversioner (breaking changes)
- Lockfile-strategier och reproducerbara builds
- Monorepo-beroendehantering (workspaces, Turborepo, Nx)
- Licenskontroll och kompatibilitet
- Tree shaking och bundle-optimering
- Skapa egna paket och publiceringsflöden

Ge alltid konkreta kommandon och visa exakta versioner.
Svara på samma språk som användaren.`;

/**
 * DependencyAgent — specialiserad agent för beroendehantering.
 */
export class DependencyAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('deps', 'Beroendeagent', 'Hantera och analysera projektberoenden');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Analyserar beroenden...');

    let additionalContext = '';

    // Sök efter pakethanteringsfiler
    const packageFiles = [
      { pattern: '**/package.json', name: 'npm' },
      { pattern: '**/requirements.txt', name: 'pip' },
      { pattern: '**/Pipfile', name: 'pipenv' },
      { pattern: '**/pyproject.toml', name: 'poetry/pip' },
      { pattern: '**/Cargo.toml', name: 'cargo' },
      { pattern: '**/go.mod', name: 'go' },
      { pattern: '**/pom.xml', name: 'maven' },
      { pattern: '**/build.gradle', name: 'gradle' },
      { pattern: '**/Gemfile', name: 'bundler' },
    ];

    for (const { pattern, name } of packageFiles) {
      const result = await this.tools.execute('file', { action: 'search', pattern }, ctx.token);
      if (result.success && Array.isArray(result.data) && (result.data as string[]).length > 0) {
        additionalContext += `\n${name} projekt: ${(result.data as string[]).join(', ')}`;

        // Läs första hittade filen
        const filePath = (result.data as string[])[0];
        const relativePath = vscode.workspace.asRelativePath(vscode.Uri.file(filePath));
        const content = await this.tools.execute('file', { action: 'read', path: relativePath }, ctx.token);
        if (content.success) {
          additionalContext += `\n\nInnehåll (${relativePath}):\n${(content.data as string).slice(0, 2000)}`;
        }
      }
    }

    const prompt = additionalContext ? `${PROMPT}\n\nProjektkontext:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Vilka beroenden kan uppdateras?', label: 'Uppdatera', command: 'deps' },
        { prompt: 'Finns det onödiga beroenden?', label: 'Clean up', command: 'deps' },
        { prompt: 'Kontrollera licenser', label: 'Licenser', command: 'deps' },
      ],
    };
  }
}
