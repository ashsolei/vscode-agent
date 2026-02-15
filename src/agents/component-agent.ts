import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom fullstack-komponentgenerator. Du genererar KOMPLETTA, produktionsklara UI-komponenter med tillhörande logik.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "files": [
    { "path": "sökväg", "content": "filinnehåll" }
  ],
  "summary": "beskrivning"
}

Du genererar:
- React/Vue/Svelte/Angular-komponenter med komplett JSX/template
- Styling (Tailwind, CSS Modules, Styled Components, eller vanlig CSS)
- Custom hooks / composables för komponentlogik
- TypeScript-typer och interfaces
- Storybook-stories
- Komponenttester
- Tillgänglighet (ARIA, semantic HTML, keyboard navigation)
- Responsiv design (mobile first)
- Loading states, error states, empty states
- Animationer och transitions

Regler:
- Fullständig, körbar kod — inga platshållare
- Korrekt TypeScript-typning
- Responsiv design som standard
- Tillgänglig (A11Y) som standard
- Inkludera alla varianter och states`;

/**
 * ComponentAgent — genererar kompletta UI-komponenter autonomt.
 */
export class ComponentAgent extends BaseAgent {
  constructor() {
    super('component', 'Komponentgenerator', 'Generera kompletta UI-komponenter', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '🎨 Analyserar UI-behov...');

    let projectContext = '';

    // Identifiera ramverk
    const packageJson = await executor.readFile('package.json');
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const frameworks: string[] = [];
        if (deps['react']) { frameworks.push(`React ${deps['react']}`); }
        if (deps['vue']) { frameworks.push(`Vue ${deps['vue']}`); }
        if (deps['svelte']) { frameworks.push('Svelte'); }
        if (deps['@angular/core']) { frameworks.push('Angular'); }
        if (deps['tailwindcss']) { frameworks.push('Tailwind CSS'); }
        if (deps['styled-components']) { frameworks.push('Styled Components'); }
        if (deps['next']) { frameworks.push(`Next.js ${deps['next']}`); }
        if (deps['nuxt']) { frameworks.push(`Nuxt ${deps['nuxt']}`); }
        projectContext += `\nRamverk: ${frameworks.join(', ') || 'Inget hittat'}`;
      } catch { /* ignore */ }
    }

    // Hitta befintliga komponenter
    const components = await executor.findFiles('**/{components,ui}/**/*.{tsx,jsx,vue,svelte}');
    if (components.length > 0) {
      projectContext += `\n\nBefintliga komponenter:\n${components.slice(0, 15).join('\n')}`;

      // Läs en exempelkomponent för stilkonvention
      const first = components[0];
      const content = await executor.readFile(first);
      if (content) {
        projectContext += `\n\nExempel på kodstil (${first}):\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``;
      }
    }

    this.progress(ctx, '🤖 Genererar komponent...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Projektkontext:\n${projectContext}\n\nKomponent att skapa: ${ctx.request.prompt}`
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
      this.progress(ctx, `🧩 Skapar ${result.files.length} filer...`);

      for (const file of result.files) {
        await executor.createFile(file.path, file.content);
      }

      executor.reportSummary();
      if (result.summary) { ctx.stream.markdown(`\n${result.summary}\n`); }
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${err}`);
    }

    return {
      followUps: [
        { prompt: 'Lägg till Storybook-stories', label: 'Storybook', command: 'component' },
        { prompt: 'Lägg till tester', label: 'Tester', command: 'component' },
        { prompt: 'Gör komponenten responsiv', label: 'Responsiv', command: 'component' },
      ],
    };
  }
}
