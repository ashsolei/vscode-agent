import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom CLI-byggare. Du skapar KOMPLETTA, körklara kommandoradsprogram.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "files": [
    { "path": "sökväg", "content": "filinnehåll" }
  ],
  "setupCommands": ["npm install", "chmod +x cli.ts"],
  "usage": "hur man kör/använder CLI:t",
  "summary": "beskrivning"
}

Du skapar:
- CLI med Commander/Yargs/Clap/Cobra
- Interaktiva prompts (Inquirer, prompts)
- Färglagd output (chalk/picocolors)
- Progressbarer och spinners (ora)
- Konfigurationshantering (~/.clirc)
- Subcommands med hjälptext
- Tab-completion
- Man-pages / --help
- Binärpaket (pkg, nexe)
- npx-körbart format

Regler:
- Komplett, körbar kod
- Välstrukturerad med separata filer per kommando
- Meningsfull --help för alla kommandon
- Felhantering med tydliga meddelanden
- Exit-koder (0 = ok, 1 = fel)`;

/**
 * CliAgent — bygger kompletta CLI-verktyg autonomt.
 */
export class CliAgent extends BaseAgent {
  constructor() {
    super('cli', 'CLI-byggare', 'Skapa kompletta kommandoradsprogram');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '⌨️ Designar CLI...');

    let projectContext = '';

    const packageJson = await executor.readFile('package.json');
    if (packageJson) { projectContext += `package.json:\n${packageJson}\n`; }

    const rootFiles = await executor.listDir();
    projectContext += `\nProjektstruktur:\n${rootFiles.map(f => f.name).join(', ')}`;

    this.progress(ctx, '🤖 Genererar CLI...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Kontext:\n${projectContext}\n\nCLI att skapa: ${ctx.request.prompt}`
      ),
    ];

    const response = await ctx.request.model.sendRequest(messages, {}, ctx.token);
    let fullResponse = '';
    for await (const fragment of response.text) { fullResponse += fragment; }

    const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      ctx.stream.markdown(fullResponse);
      return {};
    }

    try {
      const result = JSON.parse(jsonMatch[1]);
      this.progress(ctx, `🔨 Skapar ${result.files.length} CLI-filer...`);

      for (const file of result.files) {
        await executor.createFile(file.path, file.content);
      }

      executor.reportSummary();

      if (result.usage) {
        ctx.stream.markdown(`\n### Användning\n\`\`\`bash\n${result.usage}\n\`\`\`\n`);
      }

      if (result.setupCommands?.length > 0) {
        ctx.stream.markdown('\n**Setup:**\n');
        for (const cmd of result.setupCommands) {
          ctx.stream.markdown(`\`\`\`bash\n${cmd}\n\`\`\`\n`);
        }
      }
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${err}`);
    }

    return {
      followUps: [
        { prompt: 'Lägg till interaktiva prompts', label: 'Interaktiv', command: 'cli' },
        { prompt: 'Lägg till tester för CLI:t', label: 'Tester', command: 'cli' },
        { prompt: 'Gör det npx-körbart', label: 'npx', command: 'cli' },
      ],
    };
  }
}
