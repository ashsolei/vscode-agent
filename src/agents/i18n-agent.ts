import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom internationaliserings-expert (i18n). Du skapar KOMPLETTA i18n-uppsättningar och översätter innehåll.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "files": [
    { "path": "sökväg", "content": "filinnehåll" }
  ],
  "extractedStrings": 42,
  "languages": ["sv", "en", "de"],
  "summary": "beskrivning"
}

Du kan:
- Extrahera hårdkodade strängar från kod och ersätta med i18n-nycklar
- Skapa översättningsfiler (JSON, YAML, PO, XLIFF)
- Konfigurera i18n-bibliotek (react-intl, next-intl, vue-i18n, i18next, gettext)
- Generera maskinöversättningar till valfritt antal språk
- Hantera pluralformer, interpolation, datum/nummer-formatering
- RTL-stöd (arabiska, hebreiska)
- Verktyg för översättarteam (extrahera/importera)

Regler:
- Använd semantiska nycklar (t.ex. "user.profile.title", inte "string_42")
- Inkludera kontext-kommentarer för översättare
- Bevara interpolation ({name}, {{count}})
- Hantera pluralformer korrekt per språk`;

/**
 * I18nAgent — extraherar strängar, skapar översättningsfiler, konfigurerar i18n autonomt.
 */
export class I18nAgent extends BaseAgent {
  constructor() {
    super('i18n', 'I18n-agent', 'Internationalisering och översättning', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '🌍 Analyserar för internationalisering...');

    let projectContext = '';

    // Hitta source-filer med potentiella hårdkodade strängar
    const uiFiles = await executor.findFiles('**/*.{tsx,jsx,vue,svelte}');
    if (uiFiles.length > 0) {
      projectContext += `\nUI-filer: ${uiFiles.slice(0, 15).join(', ')}`;

      // Läs några filer
      for (const f of uiFiles.slice(0, 5)) {
        const content = await executor.readFile(f);
        if (content) {
          projectContext += `\n\n--- ${f} ---\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``;
        }
      }
    }

    // Kolla befintlig i18n-setup
    const i18nFiles = await executor.findFiles('**/{locales,i18n,lang,translations}/**');
    if (i18nFiles.length > 0) {
      projectContext += `\n\nBefintliga i18n-filer: ${i18nFiles.join(', ')}`;
    }

    const packageJson = await executor.readFile('package.json');
    if (packageJson) { projectContext += `\n\npackage.json:\n${packageJson}`; }

    this.progress(ctx, '🤖 Genererar i18n-setup...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Projektkontext:\n${projectContext}\n\nBegäran: ${ctx.request.prompt}`
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
      this.progress(ctx, `🌐 Skapar ${result.files.length} i18n-filer...`);

      for (const file of result.files) {
        await executor.createFile(file.path, file.content);
      }

      executor.reportSummary();

      if (result.languages) {
        ctx.stream.markdown(`\n**Språk:** ${result.languages.join(', ')}\n`);
      }
      if (result.extractedStrings) {
        ctx.stream.markdown(`**Extraherade strängar:** ${result.extractedStrings}\n`);
      }
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${err}`);
    }

    return {
      followUps: [
        { prompt: 'Lägg till fler språk: franska, spanska, japanska', label: 'Fler språk', command: 'i18n' },
        { prompt: 'Extrahera strängar från alla komponenter', label: 'Extrahera', command: 'i18n' },
      ],
    };
  }
}
