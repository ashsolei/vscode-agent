import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom felfixare. Du tar emot en lista med fel och filar, och fixar ALLA fel automatiskt.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "fixes": [
    {
      "file": "relativ/sökväg.ts",
      "description": "Vad som fixades",
      "oldCode": "exakt rad/block som ersätts",
      "newCode": "ny korrigerad kod"
    }
  ],
  "newFiles": [
    { "path": "sökväg", "content": "innehåll" }
  ],
  "summary": "sammanfattning av alla fixar"
}

Regler:
- Fixa ALLA fel, inte bara det första
- oldCode måste vara exakt matchande text
- Importera saknade beroenden
- Lägg till saknade typer
- Fixa syntaxfel, typfel, och logikfel
- Om en fil saknas, skapa den under newFiles
- Var aggressiv — fixa allt du kan`;

/**
 * AutoFixAgent — hittar och fixar ALLA fel i arbetsytan autonomt.
 * Analyserar diagnostik, ber LLM om fix, applicerar ändringarna.
 */
export class AutoFixAgent extends BaseAgent {
  constructor() {
    super('autofix', 'Autofixare', 'Hitta och fixa alla fel automatiskt', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream, this.diffPreview);

    this.progress(ctx, '🔍 Skannar arbetsytan efter fel...');

    // Samla alla fel
    const errors = executor.getDiagnostics(vscode.DiagnosticSeverity.Error);
    const warnings = executor.getDiagnostics(vscode.DiagnosticSeverity.Warning);

    if (errors.length === 0 && warnings.length === 0) {
      ctx.stream.markdown('✅ **Inga fel eller varningar hittades i arbetsytan!**');
      return {};
    }

    ctx.stream.markdown(`Hittade **${errors.length} fel** och **${warnings.length} varningar**.\n\n`);

    // Samla unika filer med fel
    const errorFiles = [...new Set(errors.map(e => e.file))];

    // Läs innehållet i filer med fel
    let fileContents = '';
    for (const file of errorFiles.slice(0, 10)) {
      const content = await executor.readFile(file);
      if (content) {
        fileContents += `\n\n--- ${file} ---\n\`\`\`\n${content}\n\`\`\``;
      }
    }

    // Formatera felmeddelanden
    const errorList = errors.map(e => `${e.file}:${e.line}: ${e.message}`).join('\n');
    const warningList = warnings.slice(0, 20).map(w => `${w.file}:${w.line}: ${w.message}`).join('\n');

    this.progress(ctx, '🤖 Genererar fixar...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `FEL:\n${errorList}\n\nVARNINGAR:\n${warningList}\n\nFILER:${fileContents}\n\n${ctx.request.prompt}`
      ),
    ];

    const fullResponse = await this.chatRaw(ctx, messages);

    if (this.isCancelled(ctx)) { return {}; }

    // Extrahera och applicera fixar (robust parsning)
    const result = this.extractJson<{
      fixes?: Array<{ file: string; description: string; oldCode: string; newCode: string }>;
      newFiles?: Array<{ path: string; content: string }>;
      summary?: string;
    }>(fullResponse);

    if (!result) {
      ctx.stream.markdown('⚠️ Kunde inte generera fixar automatiskt. Visar analys istället:\n\n');
      ctx.stream.markdown(fullResponse);
      return {};
    }

    try {

      this.progress(ctx, `🔧 Applicerar ${result.fixes?.length ?? 0} fixar...`);

      // Applicera kodfixar
      for (const fix of (result.fixes ?? [])) {
        const editResult = await executor.editFile(fix.file, fix.oldCode, fix.newCode);
        if (editResult.success) {
          ctx.stream.markdown(`✅ **${fix.file}**: ${fix.description}\n`);
        } else {
          ctx.stream.markdown(`⚠️ **${fix.file}**: Kunde inte applicera fix — ${fix.description}\n`);
        }
      }

      // Skapa nya filer om behövs
      for (const newFile of (result.newFiles ?? [])) {
        await executor.createFile(newFile.path, newFile.content);
      }

      executor.reportSummary();

      if (result.summary) {
        ctx.stream.markdown(`\n${result.summary}\n`);
      }

    } catch (err) {
      ctx.stream.markdown(`❌ Fel vid parsning av fixar: ${this.formatError(err)}`);
    }

    return {
      followUps: [
        { prompt: 'Kör autofix igen', label: 'Kör igen', command: 'autofix' },
        { prompt: 'Visa kvarvarande fel', label: 'Kvarvarande', command: 'autofix' },
      ],
    };
  }
}
