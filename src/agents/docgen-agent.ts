import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom dokumentationsgenerator som skapar KOMPLETT projektdokumentation.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "files": [
    { "path": "sökväg", "content": "markdown-innehåll" }
  ],
  "summary": "vad som dokumenterades"
}

Du genererar:
- README.md med badges, installation, användning, API-referens
- CONTRIBUTING.md med utvecklingsguide, kodkonventioner
- CHANGELOG.md med semantisk versionering
- API-dokumentation med alla endpoints/metoder
- Arkitekturdokumentation med diagram (Mermaid)
- Inline JSDoc/docstring för alla publika klasser och metoder
- Sekvensdiagram för komplexa flöden
- Konfigurationsreferens
- FAQ och troubleshooting
- Deployment-guide

Regler:
- Läs ALL källkod och generera korrekt dokumentation
- Inkludera faktiska kodexempel från projektet
- Mermaid-diagram för arkitektur och flöden
- Badges för CI, coverage, version, licens
- Innehållsförteckning i långa dokument`;

/**
 * DocGenAgent — scannar hela kodbasen och genererar komplett dokumentation autonomt.
 */
export class DocGenAgent extends BaseAgent {
  constructor() {
    super('docgen', 'Dokumentationsgenerator', 'Generera komplett projektdokumentation', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '📖 Skannar kodbasen...');

    let projectContext = '';

    // Scanna projektstruktur
    const rootFiles = await executor.listDir();
    projectContext += `Projektstruktur:\n${rootFiles.map(f => `${f.isDir ? '📁' : '📄'} ${f.name}`).join('\n')}`;

    // Läs konfiguration
    const configItems = ['package.json', 'tsconfig.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'];
    for (const ci of configItems) {
      const content = await executor.readFile(ci);
      if (content) { projectContext += `\n\n--- ${ci} ---\n${content}`; }
    }

    // Läs alla källkodsfiler
    const sourceFiles = await executor.findFiles('src/**/*.{ts,tsx,js,jsx,py,rs,go}');
    for (const sf of sourceFiles.slice(0, 20)) {
      const content = await executor.readFile(sf);
      if (content) {
        projectContext += `\n\n--- ${sf} ---\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``;
      }
    }

    // Befintlig README
    const readme = await executor.readFile('README.md');
    if (readme) { projectContext += `\n\nBefintlig README.md:\n${readme}`; }

    this.progress(ctx, '🤖 Genererar dokumentation...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Projekt:\n${projectContext}\n\nBegäran: ${ctx.request.prompt}`
      ),
    ];

    const fullResponse = await this.chatRaw(ctx, messages);

    if (this.isCancelled(ctx)) { return {}; }

    const result = this.extractJson<{
      files: Array<{ path: string; content: string }>;
      summary?: string;
    }>(fullResponse);

    if (!result) {
      ctx.stream.markdown(fullResponse);
      return {};
    }

    try {
      this.progress(ctx, `📝 Skapar ${result.files.length} dokumentationsfiler...`);

      for (const file of result.files) {
        await executor.createFile(file.path, file.content);
      }

      executor.reportSummary();
      if (result.summary) { ctx.stream.markdown(`\n${result.summary}\n`); }
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${this.formatError(err)}`);
    }

    return {
      followUps: [
        { prompt: 'Generera API-dokumentation', label: 'API-docs', command: 'docgen' },
        { prompt: 'Lägg till JSDoc i alla filer', label: 'JSDoc', command: 'docgen' },
        { prompt: 'Skapa ett arkitekturdiagram', label: 'Diagram', command: 'docgen' },
      ],
    };
  }
}
