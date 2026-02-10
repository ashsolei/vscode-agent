import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom tillgänglighets-expert (accessibility / a11y). Du granskar OCH fixar tillgänglighetsproblem i koden.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "issues": [
    {
      "severity": "critical" | "major" | "minor",
      "wcag": "WCAG 2.1 kriterium (t.ex. 1.1.1)",
      "description": "beskrivning av problemet",
      "file": "sökväg",
      "fix": {
        "oldCode": "befintlig kod",
        "newCode": "fixad kod"
      }
    }
  ],
  "newFiles": [
    { "path": "sökväg", "content": "innehåll" }
  ],
  "score": 0-100,
  "summary": "sammanfattning"
}

Du granskar:
- Alt-text på bilder
- Semantic HTML (header, nav, main, article, etc.)
- ARIA-attribut och roller
- Tangentbordsnavigation (tabindex, focus management)
- Färgkontrast (WCAG AA/AAA)
- Form-etiketter och felmeddelanden
- Skip-to-content-länkar
- Screen reader-stöd
- Fokusordning och fokus-indikatorer
- Responsiv typografi och zoom-stöd
- Media-alternativ (captions, transcripts)

Regler:
- Fixa ALLA problem du hittar
- Referera alltid WCAG-kriterium
- Ge allvarlighetsgrad per problem
- Ge en totalpoäng 0-100
- Skapa en a11y-testfil om den saknas`;

/**
 * A11yAgent — granskar och fixar tillgänglighetsproblem autonomt.
 */
export class A11yAgent extends BaseAgent {
  constructor() {
    super('a11y', 'Tillgänglighetsagent', 'A11Y-granskning och automatisk fix');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '♿ Skannar för tillgänglighetsproblem...');

    let projectContext = '';

    // Hitta UI-filer
    const uiFiles = await executor.findFiles('**/*.{tsx,jsx,vue,svelte,html}');
    if (uiFiles.length === 0) {
      ctx.stream.markdown('⚠️ Inga UI-filer hittades i arbetsytan.');
      return {};
    }

    projectContext += `UI-filer: ${uiFiles.join(', ')}\n`;

    // Läs komponentfiler
    for (const f of uiFiles.slice(0, 8)) {
      const content = await executor.readFile(f);
      if (content) {
        projectContext += `\n--- ${f} ---\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``;
      }
    }

    this.progress(ctx, '🤖 Analyserar tillgänglighet...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Filer att granska:\n${projectContext}\n\n${ctx.request.prompt}`
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

      // Visa poäng
      const score = result.score ?? 0;
      const emoji = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
      ctx.stream.markdown(`## ${emoji} Tillgänglighetspoäng: **${score}/100**\n\n`);

      // Applicera fixar
      let fixCount = 0;
      for (const issue of (result.issues ?? [])) {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟡' : '🟢';
        ctx.stream.markdown(`${icon} **WCAG ${issue.wcag}**: ${issue.description}\n`);

        if (issue.fix && issue.file) {
          const editResult = await executor.editFile(issue.file, issue.fix.oldCode, issue.fix.newCode);
          if (editResult.success) { fixCount++; }
        }
      }

      // Skapa nya filer
      for (const nf of (result.newFiles ?? [])) {
        await executor.createFile(nf.path, nf.content);
      }

      ctx.stream.markdown(`\n**${fixCount} problem fixade automatiskt.**\n`);
      executor.reportSummary();
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${err}`);
    }

    return {
      followUps: [
        { prompt: 'Kör en ny granskning efter fixarna', label: 'Ny granskning', command: 'a11y' },
        { prompt: 'Skapa a11y-tester', label: 'A11Y-tester', command: 'a11y' },
      ],
    };
  }
}
