import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';
import { SharedState } from '../state';

const PROMPT = `Du är en autonom planerare och implementerare. Du bryter ner komplexa uppgifter i en detaljerad EXEKVERINGSPLAN med filer som ska skapas/ändras.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "plan": {
    "title": "Planens namn",
    "steps": [
      {
        "id": 1,
        "title": "Steg-titel",
        "description": "Detaljerad beskrivning",
        "files": [
          {
            "action": "create" | "edit" | "delete",
            "path": "sökväg",
            "content": "innehåll (för create)",
            "oldCode": "befintlig kod (för edit)",
            "newCode": "ny kod (för edit)",
            "reason": "motivering"
          }
        ],
        "dependsOn": []
      }
    ]
  },
  "estimatedComplexity": "low" | "medium" | "high",
  "risks": ["potentiella risker"],
  "summary": "övergripande sammanfattning"
}

Regler:
- Bryt ner i ATOMÄRA steg (ett steg = en fokuseradändring)
- Ange beroenden mellan steg
- Inkludera RIKTIG kod, inte platshållare
- Ange risker och edge cases
- Ordna steg i optimal exekveringsordning
- Varje fil ska ha komplett, körbar kod`;

/**
 * PlannerAgent — autonom planerare som bryter ner uppgifter och exekverar hela planer.
 * Sparar planer i SharedState för att dela mellan fönster.
 */
export class PlannerAgent extends BaseAgent {
  constructor(private state: SharedState) {
    super('plan', 'Planeringsagent', 'Planera och exekvera komplexa implementationer', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '🧠 Analyserar uppgift och planerar...');

    // Samla projektkontext
    let projectContext = '';
    const rootFiles = await executor.listDir();
    projectContext += `Projektstruktur:\n${rootFiles.map(f => `${f.isDir ? '📁' : '📄'} ${f.name}`).join('\n')}`;

    const packageJson = await executor.readFile('package.json');
    if (packageJson) { projectContext += `\n\npackage.json:\n${packageJson}`; }

    const sourceFiles = await executor.findFiles('src/**/*.{ts,tsx,js,jsx,py}');
    if (sourceFiles.length > 0) {
      projectContext += `\n\nKällfiler: ${sourceFiles.join('\n')}`;
    }

    // Läs nyckel-filer
    for (const sf of sourceFiles.slice(0, 5)) {
      const content = await executor.readFile(sf);
      if (content) {
        projectContext += `\n\n--- ${sf} ---\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``;
      }
    }

    this.progress(ctx, '🤖 Genererar exekveringsplan...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Projektkontext:\n${projectContext}\n\nUppgift: ${ctx.request.prompt}`
      ),
    ];

    const fullResponse = await this.chatRaw(ctx, messages);

    if (this.isCancelled(ctx)) { return {}; }

    const result = this.extractJson<{
      plan: {
        title: string;
        steps: Array<{
          id: number; title: string; description: string;
          files?: Array<{ action: string; path: string; content?: string; oldCode?: string; newCode?: string }>;
          dependsOn?: number[];
        }>;
      };
      estimatedComplexity?: string;
      risks?: string[];
      summary?: string;
    }>(fullResponse);

    if (!result) {
      ctx.stream.markdown(fullResponse);
      return {};
    }

    try {
      const plan = result.plan;

      // Spara planen i delat tillstånd
      this.state.set('currentPlan', plan);

      ctx.stream.markdown(`## 📋 ${plan.title}\n\n`);
      ctx.stream.markdown(`**Komplexitet:** ${result.estimatedComplexity}\n\n`);

      // Exekvera planen steg för steg
      for (const step of plan.steps) {
        ctx.stream.markdown(`### Steg ${step.id}: ${step.title}\n`);
        ctx.stream.markdown(`${step.description}\n\n`);

        for (const file of (step.files ?? [])) {
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
      }

      executor.reportSummary();

      if (result.risks?.length > 0) {
        ctx.stream.markdown('\n### ⚠️ Risker\n');
        for (const risk of result.risks) {
          ctx.stream.markdown(`- ${risk}\n`);
        }
      }
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${this.formatError(err)}`);
    }

    return {
      followUps: [
        { prompt: 'Visa den sparade planen', label: 'Visa plan', command: 'status' },
        { prompt: 'Verifiera att alla steg utfördes korrekt', label: 'Verifiera', command: 'plan' },
      ],
    };
  }
}
