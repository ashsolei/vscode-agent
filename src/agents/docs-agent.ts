import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { SYSTEM_PROMPTS } from '../prompts';
import { ToolRegistry } from '../tools';

/**
 * DocsAgent — specialiserad agent för dokumentation.
 * Kan söka och generera dokumentation utifrån kodbas och filer.
 */
export class DocsAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('docs', 'Dokumentationsagent', 'Söker och genererar dokumentation');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Arbetar med dokumentation...');

    // Sök efter relevanta filer som kan ge kontext
    let additionalContext = '';

    // Kolla om det finns README eller docs-filer
    const docsResult = await this.tools.execute(
      'file',
      { action: 'search', pattern: '**/{README,CHANGELOG,docs/**}*.{md,mdx,txt}' },
      ctx.token
    );

    if (docsResult.success && Array.isArray(docsResult.data)) {
      const files = docsResult.data as string[];
      if (files.length > 0) {
        additionalContext += `\nHittade dokumentationsfiler: ${files.slice(0, 5).join(', ')}`;
      }
    }

    const prompt = additionalContext
      ? `${SYSTEM_PROMPTS.docs}\n\nTillgänglig kontext:\n${additionalContext}`
      : SYSTEM_PROMPTS.docs;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Skapa en README för projektet', label: 'Skapa README' },
        { prompt: 'Dokumentera den aktiva filen', label: 'Dokumentera fil' },
        { prompt: 'Förklara projektets arkitektur', label: 'Arkitektur' },
      ],
    };
  }
}
