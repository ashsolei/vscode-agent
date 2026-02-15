import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom kodanalytiker som skapar djupgående kodmetriker och kvalitetsrapporter.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "metrics": {
    "totalFiles": 0,
    "totalLines": 0,
    "codeLines": 0,
    "commentLines": 0,
    "blankLines": 0,
    "avgComplexity": 0,
    "duplicateBlocks": 0,
    "techDebt": "low|medium|high|critical",
    "maintainabilityIndex": 0-100 
  },
  "fileMetrics": [
    {
      "file": "sökväg",
      "lines": 0,
      "complexity": 0,
      "issues": ["lista med problem"],
      "rating": "A|B|C|D|F"
    }
  ],
  "hotspots": ["filer med flest problem"],
  "duplicates": [
    { "files": ["fil1", "fil2"], "lines": "radintervall", "similarity": 95 }
  ],
  "recommendations": ["förbättringsförslag"],
  "summary": "övergripande bedömning"
}

Analysera:
- Radantal per fil (kod, kommentarer, blank)
- Cyklomatisk komplexitet per funktion
- Kodduplicering (copy-paste-kod)
- Teknisk skuld (föråldrade mönster, TODO:s, hacks)
- Underhållbarhetsindex per fil (A-F betyg)
- Beroendekoppling (fan-in, fan-out)
- Testcoverage (om möjligt)
- Kodkonventioner och konsistens`;

/**
 * MetricsAgent — analyserar hela kodbasen och genererar kvalitetsrapport.
 */
export class MetricsAgent extends BaseAgent {
  constructor() {
    super('metrics', 'Metrikagent', 'Kodkvalitetsmetriker och analysrapport', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream, this.diffPreview);

    this.progress(ctx, '📊 Analyserar kodbasen...');

    let projectContext = '';

    // Samla alla källkodsfiler
    const allFiles = await executor.findFiles('**/*.{ts,tsx,js,jsx,py,rs,go,java,cs,rb}');
    projectContext += `Källfiler (${allFiles.length}):\n${allFiles.join('\n')}`;

    // Läs filer
    let totalContent = '';
    for (const f of allFiles.slice(0, 25)) {
      const content = await executor.readFile(f);
      if (content) {
        totalContent += `\n\n--- ${f} ---\n\`\`\`\n${content}\n\`\`\``;
      }
    }

    projectContext += totalContent;

    this.progress(ctx, '🤖 Beräknar metriker...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Analysera denna kodbas:\n${projectContext}\n\n${ctx.request.prompt}`
      ),
    ];

    const fullResponse = await this.chatRaw(ctx, messages);

    if (this.isCancelled(ctx)) { return {}; }

    const result = this.extractJson<{
      metrics: {
        totalFiles: number; totalLines: number; codeLines: number;
        commentLines: number; blankLines: number; avgComplexity: number;
        duplicateBlocks: number; techDebt: string; maintainabilityIndex: number;
      };
      fileMetrics?: Array<{ file: string; lines: number; complexity: number; issues: string[]; rating: string }>;
      hotspots?: string[];
      duplicates?: Array<{ files: string[]; lines: string; similarity: number }>;
      recommendations?: string[];
      summary?: string;
    }>(fullResponse);

    if (!result) {
      ctx.stream.markdown(fullResponse);
      return {};
    }

    try {
      const m = result.metrics;

      // Rendera en snygg rapport
      ctx.stream.markdown(`## 📊 Kodkvalitetsrapport\n\n`);

      const debtEmoji = m.techDebt === 'low' ? '🟢' : m.techDebt === 'medium' ? '🟡' : '🔴';
      
      ctx.stream.markdown(`| Metrik | Värde |\n|--------|-------|\n`);
      ctx.stream.markdown(`| Filer | ${m.totalFiles} |\n`);
      ctx.stream.markdown(`| Totala rader | ${m.totalLines} |\n`);
      ctx.stream.markdown(`| Kodrader | ${m.codeLines} |\n`);
      ctx.stream.markdown(`| Kommentarer | ${m.commentLines} |\n`);
      ctx.stream.markdown(`| Genomsnittlig komplexitet | ${m.avgComplexity} |\n`);
      ctx.stream.markdown(`| Duplicerade block | ${m.duplicateBlocks} |\n`);
      ctx.stream.markdown(`| Teknisk skuld | ${debtEmoji} ${m.techDebt} |\n`);
      ctx.stream.markdown(`| Underhållbarhet | **${m.maintainabilityIndex}/100** |\n\n`);

      // Fil-betyg
      if (result.fileMetrics && result.fileMetrics.length > 0) {
        ctx.stream.markdown('### Filer per betyg\n\n');
        ctx.stream.markdown('| Fil | Rader | Komplexitet | Betyg |\n|-----|-------|-------------|-------|\n');
        for (const fm of result.fileMetrics.slice(0, 15)) {
          ctx.stream.markdown(`| \`${fm.file}\` | ${fm.lines} | ${fm.complexity} | **${fm.rating}** |\n`);
        }
      }

      // Hotspots
      if (result.hotspots && result.hotspots.length > 0) {
        ctx.stream.markdown('\n### 🔥 Hotspots\n');
        for (const h of result.hotspots) {
          ctx.stream.markdown(`- ${h}\n`);
        }
      }

      // Rekommendationer
      if (result.recommendations && result.recommendations.length > 0) {
        ctx.stream.markdown('\n### 💡 Rekommendationer\n');
        for (const r of result.recommendations) {
          ctx.stream.markdown(`- ${r}\n`);
        }
      }

      // Spara rapport som fil
      const reportContent = `# Kodkvalitetsrapport\n\n${result.summary}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
      await executor.createFile('.quality-report.md', reportContent);

      executor.reportSummary();

    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${this.formatError(err)}`);
    }

    return {
      followUps: [
        { prompt: 'Fixa alla hotspots automatiskt', label: 'Fixa hotspots', command: 'autofix' },
        { prompt: 'Detaljera de mest komplexa funktionerna', label: 'Komplexitet', command: 'metrics' },
      ],
    };
  }
}
