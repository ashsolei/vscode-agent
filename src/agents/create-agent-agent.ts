import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

/**
 * CreateAgentAgent — en meta-agent som genererar helt nya agenter dynamiskt.
 *
 * Användaren beskriver vad agenten ska göra, och LLM genererar:
 * 1. TypeScript-kod för en ny agent-klass
 * 2. Plugin-JSON (för .agent-plugins/)
 * 3. Dokumentation
 *
 * Modes:
 * - `plugin` (default): Skapa en JSON-plugin som hot-reloadas
 * - `code`: Generera en fullständig TypeScript-agent med klass
 * - `template`: Visa en tom mall att fylla i
 */
export class CreateAgentAgent extends BaseAgent {
  constructor() {
    super(
      'create-agent',
      'Create Agent',
      'Skapa nya agenter dynamiskt med AI',
      { isAutonomous: true }
    );
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);
    const prompt = ctx.request.prompt.toLowerCase();

    if (prompt.includes('template') || prompt.includes('mall')) {
      return this.showTemplate(ctx, executor);
    }

    if (prompt.includes('typescript') || prompt.includes('code') || prompt.includes('klass')) {
      return this.generateTypeScriptAgent(ctx, executor);
    }

    // Default: plugin-mode
    return this.generatePlugin(ctx, executor);
  }

  /**
   * Generera en JSON-plugin via LLM.
   */
  private async generatePlugin(
    ctx: AgentContext,
    executor: AutonomousExecutor
  ): Promise<AgentResult> {
    this.progress(ctx, '🧬 Genererar plugin-agent...');

    ctx.stream.markdown('## 🧬 Skapar ny plugin-agent\n\n');

    const genPrompt = `Du är en expert på att designa AI-agenter. Baserat på användarens beskrivning, generera en plugin-definition i JSON-format.

Användarens beskrivning: "${ctx.request.prompt}"

Generera en JSON-fil med EXAKT detta schema:
{
  "id": "slug-id",
  "name": "Visningsnamn",
  "description": "Kort beskrivning",
  "systemPrompt": "Detaljerad system-prompt som styr agentens beteende. Använd {{workspaceRoot}} och {{date}} som variabler.",
  "icon": "vscode-theme-icon-namn",
  "autonomous": false,
  "tags": ["kategori1", "kategori2"],
  "delegates": [],
  "variables": {}
}

Regler:
- id ska vara kebab-case, max 20 tecken
- systemPrompt ska vara minst 100 tecken och mycket specifik
- Inkludera relevanta instruktioner för agentvens specialitet
- Välj en passande ikon från VS Code ThemeIcon (t.ex. "beaker", "shield", "rocket", "lightbulb", "tools")
- Om agenten behöver ändra filer, sätt autonomous: true
- Om agenten bör samarbeta med andra, lista deras ID:n i delegates

Svara ENBART med JSON-blocket, inget annat.`;

    const messages = [
      vscode.LanguageModelChatMessage.User(genPrompt),
    ];

    let jsonResponse = '';
    try {
      jsonResponse = await this.chatRaw(ctx, messages);
    } catch {
      ctx.stream.markdown('❌ Kunde inte generera agent-definition.\n');
      return { metadata: { agent: 'create-agent', error: 'llm-failed' } };
    }

    if (this.isCancelled(ctx)) { return {}; }

    // Extrahera JSON (robust)
    const definition = this.extractJson<{
      id?: string;
      name?: string;
      description?: string;
      systemPrompt?: string;
      icon?: string;
      autonomous?: boolean;
      tags?: string[];
      delegates?: string[];
      variables?: Record<string, unknown>;
    }>(jsonResponse);

    if (!definition) {
      ctx.stream.markdown('❌ LLM returnerade inte giltig JSON.\n');
      ctx.stream.markdown('```\n' + jsonResponse + '\n```\n');
      return { metadata: { agent: 'create-agent', error: 'parse-failed' } };
    }

    try {
      // Validera
      if (!definition.id || !definition.name || !definition.systemPrompt) {
        throw new Error('Saknar obligatoriska fält');
      }

      // Visa förhandsgranskning
      ctx.stream.markdown('### Förhandsgranskning\n\n');
      ctx.stream.markdown(`**ID:** \`${definition.id}\`\n`);
      ctx.stream.markdown(`**Namn:** ${definition.name}\n`);
      ctx.stream.markdown(`**Beskrivning:** ${definition.description}\n`);
      ctx.stream.markdown(`**Autonom:** ${definition.autonomous ? 'Ja' : 'Nej'}\n`);
      ctx.stream.markdown(`**Taggar:** ${(definition.tags ?? []).join(', ')}\n\n`);
      ctx.stream.markdown('```json\n' + JSON.stringify(definition, null, 2) + '\n```\n\n');

      // Spara till .agent-plugins/
      const fileName = `.agent-plugins/${definition.id}.json`;
      await executor.createFile(fileName, JSON.stringify(definition, null, 2));

      ctx.stream.markdown(`✅ Plugin sparad till \`${fileName}\`\n`);
      ctx.stream.markdown('Plugin-systemet laddar om den automatiskt!\n\n');
      ctx.stream.markdown(`Använd den med: \`@agent /plugin-${definition.id}\`\n`);

      executor.reportSummary();

      return {
        metadata: { agent: 'create-agent', mode: 'plugin', createdId: definition.id },
      };
    } catch (err) {
      ctx.stream.markdown(`❌ Fel vid skapande av plugin: ${this.formatError(err)}\n`);
      ctx.stream.markdown('```json\n' + JSON.stringify(definition, null, 2) + '\n```\n');
      return { metadata: { agent: 'create-agent', error: 'invalid-definition' } };
    }
  }

  /**
   * Generera en fullständig TypeScript-agent.
   */
  private async generateTypeScriptAgent(
    ctx: AgentContext,
    executor: AutonomousExecutor
  ): Promise<AgentResult> {
    this.progress(ctx, '🏗️ Genererar TypeScript-agent...');

    ctx.stream.markdown('## 🏗️ Skapar TypeScript-agent\n\n');

    const genPrompt = `Du är en expert TypeScript-utvecklare specialiserad på VS Code Chat Participant API.

Generera en komplett agent-klass baserat på denna beskrivning: "${ctx.request.prompt}"

Agenten ska:
1. Ärva från BaseAgent (import från '../agents/base-agent')
2. Ha en konstruktor som anropar super(id, name, description)
3. Implementera handle(ctx: AgentContext): Promise<AgentResult>
4. Använda this.chat() för LLM-interaktion
5. Använda this.progress() för progress-meddelanden
6. Om autonom: använda AutonomousExecutor (import från '../autonomous/executor')

Här är ett exempelpattern:

import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';

export class ExampleAgent extends BaseAgent {
  constructor() {
    super('example', 'Example Agent', 'Beskrivning');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Arbetar...');
    await this.chat(ctx, 'System-prompt här');
    return { metadata: { agent: 'example' } };
  }
}

Generera ENBART TypeScript-koden, inget annat. Inkludera alla imports.`;

    const response = await this.chat(ctx, genPrompt);

    if (this.isCancelled(ctx)) { return {}; }

    // Extrahera kod
    const codeMatch = response.match(/```typescript\n([\s\S]*?)```/) ??
                      response.match(/```ts\n([\s\S]*?)```/);

    const code = codeMatch?.[1] ?? response;

    // Extrahera klass-namn för filnamn
    const classMatch = code.match(/export class (\w+)/);
    const className = classMatch?.[1] ?? 'CustomAgent';
    const fileName = className
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
      .replace(/-agent$/, '-agent');

    const filePath = `src/agents/${fileName}.ts`;

    try {
      await executor.createFile(filePath, code);

      ctx.stream.markdown(`\n\n✅ Agent sparad till \`${filePath}\`\n\n`);
      ctx.stream.markdown('**Nästa steg:**\n');
      ctx.stream.markdown('1. Importera i `extension.ts`: `import { ' + className + " } from './agents/" + fileName + "';`\n");
      ctx.stream.markdown('2. Registrera: `registry.register(new ' + className + '());`\n');
      ctx.stream.markdown('3. Lägg till slash-command i `package.json`\n');
      ctx.stream.markdown('4. Kör `npm run compile`\n');

      executor.reportSummary();
    } catch (err) {
      ctx.stream.markdown(`❌ Fel vid skapande av agent-fil: ${this.formatError(err)}\n`);
    }

    return {
      metadata: { agent: 'create-agent', mode: 'typescript', className, filePath },
    };
  }

  /**
   * Visa tom mall.
   */
  private async showTemplate(
    ctx: AgentContext,
    executor: AutonomousExecutor
  ): Promise<AgentResult> {
    ctx.stream.markdown('## 📝 Agent-mall\n\n');

    // Plugin-template
    ctx.stream.markdown('### Plugin (JSON)\n\n');
    const pluginTemplate = {
      id: 'my-agent',
      name: 'My Agent',
      description: 'Beskriv vad agenten gör',
      systemPrompt: 'Du är en specialiserad agent som hjälper med...\n\nInstruktioner:\n- Ge tydliga svar\n- Arbetsyta: {{workspaceRoot}}\n- Datum: {{date}}',
      icon: 'lightbulb',
      autonomous: false,
      tags: ['custom'],
      delegates: [],
      variables: {},
    };
    ctx.stream.markdown('```json\n' + JSON.stringify(pluginTemplate, null, 2) + '\n```\n\n');

    // TypeScript-template
    ctx.stream.markdown('### TypeScript Agent\n\n');
    const tsTemplate = `import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';

export class MyAgent extends BaseAgent {
  constructor() {
    super('my-agent', 'My Agent', 'Beskriv vad agenten gör');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, '🚀 Arbetar...');

    const systemPrompt = \`Du är en specialiserad agent.
Hjälp användaren med specifika uppgifter.\`;

    await this.chat(ctx, systemPrompt);

    return {
      metadata: { agent: 'my-agent' },
      followUps: [
        { prompt: 'Fortsätt', label: '➡️ Fortsätt', command: 'my-agent' },
      ],
    };
  }
}`;
    ctx.stream.markdown('```typescript\n' + tsTemplate + '\n```\n\n');

    // Skapa en exempelfil via knapp istället för blockande dialog
    this.button(ctx, '📁 Skapa exempelmall', 'vscode-agent.createPlugin');

    try {
      await executor.createFile(
        '.agent-plugins/my-agent.json',
        JSON.stringify(pluginTemplate, null, 2)
      );
      ctx.stream.markdown('✅ Skapade `.agent-plugins/my-agent.json`\n');
      executor.reportSummary();
    } catch (err) {
      ctx.stream.markdown(`⚠️ Kunde inte skapa exempelfil: ${this.formatError(err)}\n`);
    }

    return { metadata: { agent: 'create-agent', mode: 'template' } };
  }
}
