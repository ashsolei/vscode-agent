import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på mjukvaruarkitektur och systemdesign. Du hjälper med:
- Arkitekturmönster: Microservices, Monolith, Event-driven, CQRS, Hexagonal
- Systemdesign: Load balancing, caching, message queues, database sharding
- Designmönster: Factory, Strategy, Observer, Decorator, Adapter, Repository
- API-design: REST, GraphQL, gRPC, WebSocket
- Datamodellering: relationsmodeller, NoSQL-schema, event sourcing
- Skalbarhet och felhantering i distribuerade system
- Clean Architecture och Domain-Driven Design (DDD)
- Monorepo-strategier och pakethantering
- Infrastructure as Code, CI/CD-pipelines
- Dokumentation av arkitekturbeslut (ADR)

Rita ASCII-diagram när det hjälper förståelsen.
Var pragmatisk — föreslå den enklaste lösningen som möter kraven.
Svara på samma språk som användaren.`;

/**
 * ArchitectAgent — specialiserad agent för arkitektur och systemdesign.
 */
export class ArchitectAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('architect', 'Arkitekturagent', 'Mjukvaruarkitektur och systemdesign');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Analyserar arkitektur...');

    let additionalContext = '';

    // Scanna projektstruktur
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      const rootResult = await this.tools.execute(
        'file',
        { action: 'list', directory: '' },
        ctx.token
      );
      if (rootResult.success) {
        additionalContext += `\n\nProjektstruktur (rot): ${JSON.stringify(rootResult.data)}`;
      }
    }

    // Sök efter konfigurationsfiler som ger arkitekturledtrådar
    const configPatterns = [
      '**/package.json', '**/tsconfig.json', '**/docker-compose.yml',
      '**/Dockerfile', '**/*.csproj', '**/pom.xml', '**/build.gradle',
      '**/requirements.txt', '**/Cargo.toml', '**/go.mod',
    ];

    for (const pattern of configPatterns) {
      const result = await this.tools.execute('file', { action: 'search', pattern }, ctx.token);
      if (result.success && Array.isArray(result.data) && (result.data as string[]).length > 0) {
        additionalContext += `\n${pattern}: ${(result.data as string[]).join(', ')}`;
      }
    }

    const prompt = additionalContext ? `${PROMPT}\n\nProjektkontext:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Rita ett arkitekturdiagram för projektet', label: 'Diagram', command: 'architect' },
        { prompt: 'Föreslå en bättre mappstruktur', label: 'Struktur', command: 'architect' },
        { prompt: 'Skriv ett ADR-beslutsdokument', label: 'ADR', command: 'architect' },
      ],
    };
  }
}
