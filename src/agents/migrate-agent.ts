import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom kodmigreringsexpert. Du migrerar HELA kodbaser mellan ramverk och versioner.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "files": [
    {
      "action": "create" | "edit" | "delete",
      "path": "sökväg",
      "content": "nytt innehåll (för create)",
      "oldCode": "befintlig kod (för edit)",
      "newCode": "ny kod (för edit)",
      "reason": "varför ändringen behövs"
    }
  ],
  "breakingChanges": ["lista med breaking changes att vara medveten om"],
  "manualSteps": ["steg som kräver manuell insats"],
  "summary": "sammanfattning"
}

Du kan migrera:
- React Class → Hooks, CRA → Vite/Next.js
- Vue 2 → Vue 3 (Options API → Composition API)
- Express → Fastify/Hono
- JavaScript → TypeScript
- CommonJS → ESM
- Webpack → Vite
- REST → GraphQL
- Jest → Vitest
- Styled Components → Tailwind
- Angular version-uppgraderingar
- Python 2 → 3, Django version-uppgraderingar
- Node.js version-uppgraderingar

Regler:
- Migrera ALLA filer, inte bara exempel
- Bevara all funktionalitet
- Uppdatera imports, konfiguration och beroenden
- Lista ALLA breaking changes`;

/**
 * MigrateAgent — migrerar hela kodbaser mellan ramverk/versioner autonomt.
 */
export class MigrateAgent extends BaseAgent {
  constructor() {
    super('migrate', 'Migreringsagent', 'Migrera mellan ramverk och versioner', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '🔄 Analyserar kodbas för migrering...');

    let projectContext = '';

    // Scanna hela projektet
    const rootFiles = await executor.listDir();
    projectContext += `Rot-struktur:\n${rootFiles.map(f => `${f.isDir ? '📁' : '📄'} ${f.name}`).join('\n')}`;

    // Läs konfigurationsfiler
    const configFiles = ['package.json', 'tsconfig.json', 'vite.config.ts', 'next.config.js',
      'webpack.config.js', '.babelrc', 'pyproject.toml', 'requirements.txt'];

    for (const cf of configFiles) {
      const content = await executor.readFile(cf);
      if (content) { projectContext += `\n\n--- ${cf} ---\n${content}`; }
    }

    // Läs källkodsfiler (max 10 filer)
    const sourceFiles = await executor.findFiles('src/**/*.{ts,tsx,js,jsx,py,vue}');
    for (const sf of sourceFiles.slice(0, 10)) {
      const content = await executor.readFile(sf);
      if (content) {
        projectContext += `\n\n--- ${sf} ---\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``;
      }
    }

    this.progress(ctx, '🤖 Planerar migrering...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Projekt:\n${projectContext}\n\nMigreringsuppdrag: ${ctx.request.prompt}`
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
      const files = result.files ?? [];

      this.progress(ctx, `⚡ Applicerar ${files.length} ändringar...`);

      for (const file of files) {
        switch (file.action) {
          case 'create':
            await executor.createFile(file.path, file.content);
            break;
          case 'edit':
            await executor.editFile(file.path, file.oldCode, file.newCode);
            break;
          case 'delete':
            await executor.deleteFile(file.path);
            break;
        }
      }

      executor.reportSummary();

      if (result.breakingChanges?.length > 0) {
        ctx.stream.markdown('\n### ⚠️ Breaking Changes\n');
        for (const bc of result.breakingChanges) {
          ctx.stream.markdown(`- ${bc}\n`);
        }
      }

      if (result.manualSteps?.length > 0) {
        ctx.stream.markdown('\n### 📋 Manuella steg\n');
        for (const step of result.manualSteps) {
          ctx.stream.markdown(`- [ ] ${step}\n`);
        }
      }
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${err}`);
    }

    return {
      followUps: [
        { prompt: 'Verifiera att migreringen är komplett', label: 'Verifiera', command: 'migrate' },
        { prompt: 'Migrera testerna också', label: 'Tester', command: 'migrate' },
      ],
    };
  }
}
