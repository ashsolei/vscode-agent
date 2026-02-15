import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom fullstack-utvecklare som bygger KOMPLETTA webbappar med frontend och backend.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "files": [
    { "path": "sökväg", "content": "filinnehåll" }
  ],
  "setupCommands": ["npm install"],
  "devCommand": "npm run dev",
  "summary": "vad som skapades"
}

Du bygger:
- Next.js / Nuxt / SvelteKit fullstack-appar
- Express/Fastify/Hono-backends med korrekt middleware-stack
- React/Vue/Svelte-frontends med state management
- Auth (sessions, JWT, OAuth)
- Databaskoppling (Prisma, Drizzle, Mongoose)
- REST/GraphQL API-lager
- Formulär med validering (Zod, Yup)
- Error boundaries och felhantering
- Environment-konfiguration (.env.example)
- Hela projektstrukturen med allt som behövs

Regler:
- ALLT ska vara körklart — inget "TODO" eller "add your logic here"
- TypeScript som standard
- Korrekt felhantering i alla lager
- Miljövariabler för alla hemligheter
- Responsiv UI som standard
- Inkludera .env.example`;

/**
 * FullstackAgent — bygger kompletta webbapplikationer med frontend, backend, databas.
 */
export class FullstackAgent extends BaseAgent {
  constructor() {
    super('fullstack', 'Fullstack-byggare', 'Bygg hela webbappar med frontend + backend + databas', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '🚀 Designar fullstack-app...');

    let projectContext = '';

    // Kolla om projektet redan har filer
    const rootFiles = await executor.listDir();
    if (rootFiles.length > 0) {
      projectContext += `Befintlig projektstruktur:\n${rootFiles.map(f => `${f.isDir ? '📁' : '📄'} ${f.name}`).join('\n')}\n`;
    }

    const packageJson = await executor.readFile('package.json');
    if (packageJson) { projectContext += `\npackage.json:\n${packageJson}`; }

    this.progress(ctx, '🤖 Genererar fullstack-app...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Projektkontext:\n${projectContext}\n\nBygg: ${ctx.request.prompt}`
      ),
    ];

    const fullResponse = await this.chatRaw(ctx, messages);

    if (this.isCancelled(ctx)) { return {}; }

    const result = this.extractJson<{
      files: Array<{ path: string; content: string }>;
      setupCommands?: string[];
      devCommand?: string;
      summary?: string;
    }>(fullResponse);

    if (!result) {
      ctx.stream.markdown(fullResponse);
      return {};
    }

    try {
      this.progress(ctx, `📦 Skapar ${result.files.length} filer...`);

      for (const file of result.files) {
        await executor.createFile(file.path, file.content);
      }

      executor.reportSummary();

      if (result.setupCommands?.length > 0) {
        ctx.stream.markdown('\n**Setup:**\n');
        for (const cmd of result.setupCommands) {
          ctx.stream.markdown(`\`\`\`bash\n${cmd}\n\`\`\`\n`);
        }
      }

      if (result.devCommand) {
        ctx.stream.markdown(`\n**Starta:**\n\`\`\`bash\n${result.devCommand}\n\`\`\`\n`);
      }

      if (result.summary) { ctx.stream.markdown(`\n${result.summary}\n`); }
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${this.formatError(err)}`);
    }

    return {
      followUps: [
        { prompt: 'Lägg till autentisering med NextAuth', label: 'Auth', command: 'fullstack' },
        { prompt: 'Lägg till betalning med Stripe', label: 'Stripe', command: 'fullstack' },
        { prompt: 'Lägg till realtid med WebSocket', label: 'WebSocket', command: 'fullstack' },
      ],
    };
  }
}
