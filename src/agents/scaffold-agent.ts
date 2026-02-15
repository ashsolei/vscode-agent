import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom projektgenerator. Din uppgift är att generera en KOMPLETT och KÖRBAR projektstruktur baserat på användarens beskrivning.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json) som innehåller:
{
  "projectName": "namn",
  "files": [
    { "path": "relativ/sökväg/fil.ts", "content": "filens fullständiga innehåll" }
  ],
  "postSetupCommands": ["npm install", "etc"],
  "summary": "kort beskrivning av vad som skapades"
}

Regler:
- Generera ALLA filer som behövs — inga platshållare
- Inkludera konfigurationsfiler (tsconfig, package.json, .gitignore, etc.)
- Inkludera README.md
- Koden ska vara idiomatisk och följa best practices
- Inga // TODO-kommentarer — skriv riktig implementation
- Svara BARA med JSON, ingen annan text`;

/**
 * ScaffoldAgent — autonomt skapar hela projektstrukturer.
 * Genererar alla filer via LLM och skriver dem till disk.
 */
export class ScaffoldAgent extends BaseAgent {
  constructor() {
    super('scaffold', 'Projektgenerator', 'Generera hela projekt autonomt', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '🏗️ Genererar projektstruktur...');

    // Be LLM att generera projektstrukturen
    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(ctx.request.prompt),
    ];

    const fullResponse = await this.chatRaw(ctx, messages);

    if (this.isCancelled(ctx)) { return {}; }

    // Extrahera JSON från svaret (robust parsning)
    const project = this.extractJson<{
      projectName?: string;
      files: Array<{ path: string; content: string }>;
      postSetupCommands?: string[];
      summary?: string;
    }>(fullResponse);

    if (!project) {
      ctx.stream.markdown('❌ Kunde inte generera projektstruktur. Försök med en mer specifik beskrivning.');
      return {};
    }

    try {

      ctx.stream.markdown(`## 🏗️ Scaffolding: ${project.projectName}\n\n`);
      this.progress(ctx, `Skapar ${project.files.length} filer...`);

      // Skapa alla filer autonomt
      const basePath = project.projectName ?? '';
      for (const file of project.files) {
        const filePath = basePath ? `${basePath}/${file.path}` : file.path;
        await executor.createFile(filePath, file.content);
      }

      // Rapportera
      executor.reportSummary();

      if (project.postSetupCommands && project.postSetupCommands.length > 0) {
        ctx.stream.markdown('\n**Kör sedan:**\n');
        for (const cmd of project.postSetupCommands) {
          ctx.stream.markdown(`\`\`\`bash\n${cmd}\n\`\`\`\n`);
        }
      }

      if (project.summary) {
        ctx.stream.markdown(`\n${project.summary}\n`);
      }

    } catch (err) {
      ctx.stream.markdown(`❌ Fel vid skapande av projektfiler: ${this.formatError(err)}`);
    }

    return {
      followUps: [
        { prompt: 'Lägg till tester i projektet', label: 'Lägg till tester', command: 'scaffold' },
        { prompt: 'Lägg till Docker-stöd', label: 'Dockerize', command: 'scaffold' },
        { prompt: 'Lägg till CI/CD-pipeline', label: 'CI/CD', command: 'scaffold' },
      ],
    };
  }
}
