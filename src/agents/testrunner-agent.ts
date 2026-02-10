import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from '../agents/base-agent';
import { AutonomousExecutor } from '../autonomous/executor';

/**
 * Resultat från en testkörning.
 */
export interface TestRunResult {
  framework: string;
  totalTests: number;
  passed: number;
  failed: number;
  errors: string[];
  failedTests: FailedTest[];
  duration: number;
}

/**
 * Info om ett misslyckat test.
 */
export interface FailedTest {
  name: string;
  file?: string;
  line?: number;
  error: string;
  expected?: string;
  actual?: string;
}

/**
 * TestRunnerAgent — kör tester, analyserar resultat, och fixar fel automatiskt.
 *
 * Capabilities:
 * - Detekterar testramverk (jest, vitest, mocha, pytest, etc.)
 * - Kör tester via terminal
 * - Parsear testresultat
 * - Analyserar fel med LLM
 * - Genererar fixar automatiskt
 * - Self-correct loop: kör → analysera → fixa → kör igen (max N iterationer)
 */
export class TestRunnerAgent extends BaseAgent {
  private maxRetries: number;

  constructor(maxRetries = 3) {
    super(
      'testrunner',
      'Test Runner',
      'Kör tester automatiskt, analyserar fel och self-corrects'
    );
    this.maxRetries = maxRetries;
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);
    const prompt = ctx.request.prompt.toLowerCase();

    // Bestäm läge
    if (prompt.includes('selfcorrect') || prompt.includes('self-correct') || prompt.includes('autofix')) {
      return this.selfCorrectLoop(ctx, executor);
    }

    if (prompt.includes('kör') || prompt.includes('run') || !prompt.trim()) {
      return this.runAndReport(ctx, executor);
    }

    // Default: LLM-assisterad testanalys
    await this.chat(ctx, `Du är en testexpert. Hjälp användaren med testrelaterade frågor.
Du kan:
- Föreslå teststrategier
- Analysera testresultat
- Hjälpa med testramverk-konfiguration
- Generera testfall

Om användaren vill köra tester, föreslå att använda /testrunner run.
Om användaren vill ha self-correcting, föreslå /testrunner selfcorrect.`);

    return { metadata: { agent: 'testrunner', mode: 'chat' } };
  }

  /**
   * Kör tester och rapportera resultat.
   */
  private async runAndReport(
    ctx: AgentContext,
    executor: AutonomousExecutor
  ): Promise<AgentResult> {
    this.progress(ctx, '🧪 Detekterar testramverk...');

    const framework = await this.detectFramework(executor);
    if (!framework) {
      ctx.stream.markdown('❌ Kunde inte detektera testramverk. Kontrollera att du har tester konfigurerade.\n\n');
      ctx.stream.markdown('**Tips:** Stödda ramverk: jest, vitest, mocha, pytest, go test, cargo test\n');
      return { metadata: { agent: 'testrunner', error: 'no-framework' } };
    }

    ctx.stream.markdown(`### 🧪 Kör tester med **${framework.name}**\n\n`);

    this.progress(ctx, `Kör: ${framework.command}...`);

    // Skriv output till en temporär fil som vi kan läsa
    const outFile = '.agent-test-output.txt';
    const cmdWithCapture = `${framework.command} > ${outFile} 2>&1 ; echo "EXIT:$?" >> ${outFile}`;
    await executor.runCommand(cmdWithCapture, { timeout: 120000 });

    const rawOutput = await executor.readFile(outFile);

    if (rawOutput) {
      const parsed = this.parseTestOutput(rawOutput, framework.name);

      ctx.stream.markdown(this.formatTestReport(parsed));

      if (parsed.failedTests.length > 0) {
        ctx.stream.markdown('\n### 💡 Förslag\n');
        ctx.stream.markdown('Använd `/testrunner selfcorrect` för att automatiskt fixa felande tester.\n');
      }

      return {
        metadata: { agent: 'testrunner', testFramework: framework.name, passed: parsed.passed, failed: parsed.failed },
        followUps: parsed.failed > 0
          ? [{ prompt: '/testrunner selfcorrect', label: '🔄 Self-correct', command: 'testrunner' }]
          : [],
      };
    }

    ctx.stream.markdown('⚠️ Testerna kunde inte köras. Kontrollera terminalen.\n');
    return { metadata: { agent: 'testrunner', error: 'run-failed' } };
  }

  /**
   * Self-correct loop:
   * 1. Kör tester
   * 2. Om fel → analysera med LLM → generera fix
   * 3. Applicera fix
   * 4. Kör tester igen
   * 5. Upprepa tills alla passerar eller max retries
   */
  private async selfCorrectLoop(
    ctx: AgentContext,
    executor: AutonomousExecutor
  ): Promise<AgentResult> {
    this.progress(ctx, '🔄 Self-correct mode...');

    const framework = await this.detectFramework(executor);
    if (!framework) {
      ctx.stream.markdown('❌ Inget testramverk detekterat.\n');
      return { metadata: { agent: 'testrunner', error: 'no-framework' } };
    }

    ctx.stream.markdown(`## 🔄 Self-Correct Loop\n`);
    ctx.stream.markdown(`**Ramverk:** ${framework.name} | **Max iterationer:** ${this.maxRetries}\n\n`);

    let iteration = 0;
    let allPassing = false;
    const fixHistory: string[] = [];

    while (iteration < this.maxRetries && !allPassing) {
      iteration++;
      ctx.stream.markdown(`\n### Iteration ${iteration}/${this.maxRetries}\n\n`);

      // 1. Kör tester
      this.progress(ctx, `🧪 Kör tester (iteration ${iteration})...`);
      const outFile = '.agent-test-output.txt';
      const cmdWithCapture = `${framework.command} > ${outFile} 2>&1 ; echo "EXIT:$?" >> ${outFile}`;
      await executor.runCommand(cmdWithCapture, { timeout: 120000 });

      const rawOutput = await executor.readFile(outFile);

      if (!rawOutput) {
        ctx.stream.markdown('❌ Misslyckades köra tester.\n');
        break;
      }

      const output = rawOutput;
      const parsed = this.parseTestOutput(output, framework.name);

      ctx.stream.markdown(
        `**Resultat:** ${parsed.passed}/${parsed.totalTests} passerade`
        + (parsed.failed > 0 ? `, ${parsed.failed} misslyckade` : '')
        + '\n\n'
      );

      if (parsed.failed === 0) {
        allPassing = true;
        break;
      }

      // 2. Analysera fel med LLM
      this.progress(ctx, '🧠 Analyserar fel...');

      const failedInfo = parsed.failedTests
        .map((t) => `Testnamn: ${t.name}\nFil: ${t.file ?? 'okänd'}\nFel: ${t.error}\n`)
        .join('\n---\n');

      const analysisPrompt = `Du är en testfixningsexpert. Analysera dessa testfel och ge EXAKTA kodfixar.

Misslyckade tester:
${failedInfo}

Tidigare försök (undvik samma fixar):
${fixHistory.join('\n')}

Testoutput:
${output.substring(0, 3000)}

Svara i detta format för VARJE fix:
FILE: <filsökväg>
OLD:
\`\`\`
<exakt kod som ska ersättas>
\`\`\`
NEW:
\`\`\`
<ny kod>
\`\`\`
REASON: <kort förklaring>

Var precis — ge exakta strängar att söka och ersätta.`;

      const fixResponse = await this.chat(ctx, analysisPrompt);
      fixHistory.push(`Iteration ${iteration}: ${fixResponse.substring(0, 200)}`);

      // 3. Försök parsa och applicera fixar
      const fixes = this.parseFixes(fixResponse);

      if (fixes.length === 0) {
        ctx.stream.markdown('⚠️ Kunde inte generera fixar. Avbryter.\n');
        break;
      }

      ctx.stream.markdown(`\n**Applicerar ${fixes.length} fixar...**\n`);

      for (const fix of fixes) {
        const content = await executor.readFile(fix.file);
        if (content && content.includes(fix.oldCode)) {
          const newContent = content.replace(fix.oldCode, fix.newCode);
          await executor.createFile(fix.file, newContent);
          ctx.stream.markdown(`✅ Fixade: \`${fix.file}\` — ${fix.reason}\n`);
        } else {
          ctx.stream.markdown(`⚠️ Kunde inte hitta matchande kod i \`${fix.file}\`\n`);
        }
      }
    }

    // Slutrapport
    ctx.stream.markdown('\n---\n');
    if (allPassing) {
      ctx.stream.markdown(`## ✅ Alla tester passerar efter ${iteration} iteration(er)!\n`);
    } else {
      ctx.stream.markdown(`## ⚠️ Avbröt efter ${iteration} iterationer. Manuell fix kan behövas.\n`);
    }

    executor.reportSummary();

    return {
      metadata: {
        agent: 'testrunner',
        mode: 'selfcorrect',
        iterations: iteration,
        success: allPassing,
      },
    };
  }

  // ─── Framework Detection ───────────────────

  private async detectFramework(
    executor: AutonomousExecutor
  ): Promise<{ name: string; command: string } | null> {
    // Kolla package.json
    const pkg = await executor.readFile('package.json');
    if (pkg) {
      try {
        const parsed = JSON.parse(pkg);
        const deps = {
          ...parsed.devDependencies,
          ...parsed.dependencies,
        };
        const scripts = parsed.scripts ?? {};

        if (deps['vitest'] || scripts['test']?.includes('vitest')) {
          return { name: 'vitest', command: 'npx vitest run --reporter=verbose 2>&1' };
        }
        if (deps['jest'] || scripts['test']?.includes('jest')) {
          return { name: 'jest', command: 'npx jest --verbose --no-coverage 2>&1' };
        }
        if (deps['mocha'] || scripts['test']?.includes('mocha')) {
          return { name: 'mocha', command: 'npx mocha --reporter spec 2>&1' };
        }
        // Generellt "test" script
        if (scripts['test']) {
          return { name: 'npm-test', command: 'npm test 2>&1' };
        }
      } catch { /* ignore parse errors */ }
    }

    // Python
    if (await executor.fileExists('pytest.ini') || await executor.fileExists('pyproject.toml')) {
      return { name: 'pytest', command: 'python -m pytest -v 2>&1' };
    }

    // Go
    if (await executor.fileExists('go.mod')) {
      return { name: 'go-test', command: 'go test ./... -v 2>&1' };
    }

    // Rust
    if (await executor.fileExists('Cargo.toml')) {
      return { name: 'cargo-test', command: 'cargo test 2>&1' };
    }

    return null;
  }

  // ─── Test Output Parsing ───────────────────

  private parseTestOutput(output: string, framework: string): TestRunResult {
    const result: TestRunResult = {
      framework,
      totalTests: 0,
      passed: 0,
      failed: 0,
      errors: [],
      failedTests: [],
      duration: 0,
    };

    const lines = output.split('\n');

    for (const line of lines) {
      // Jest / Vitest
      if (/Tests:\s+(\d+)\s+failed/i.test(line)) {
        const match = line.match(/(\d+)\s+failed/);
        if (match) { result.failed = parseInt(match[1]); }
      }
      if (/Tests:\s+(\d+)\s+passed/i.test(line)) {
        const match = line.match(/(\d+)\s+passed/);
        if (match) { result.passed = parseInt(match[1]); }
      }
      if (/Test Suites:.*?(\d+)\s+total/i.test(line)) {
        const match = line.match(/(\d+)\s+total/);
        if (match) { result.totalTests = parseInt(match[1]); }
      }

      // FAIL marker
      if (/^\s*(FAIL|✕|✖|×|FAILED)\s+/i.test(line)) {
        const testName = line.replace(/^\s*(FAIL|✕|✖|×|FAILED)\s+/i, '').trim();
        result.failedTests.push({
          name: testName,
          error: this.extractErrorContext(lines, lines.indexOf(line)),
        });
      }

      // pytest
      if (/FAILED\s+(.+)::/i.test(line)) {
        const match = line.match(/FAILED\s+(.+?)::(.+)/);
        if (match) {
          result.failedTests.push({
            name: match[2],
            file: match[1],
            error: line,
          });
          result.failed++;
        }
      }

      // Timing
      if (/Time:\s+([\d.]+)\s*s/i.test(line)) {
        const match = line.match(/([\d.]+)\s*s/);
        if (match) { result.duration = parseFloat(match[1]); }
      }
    }

    // Om totalTests inte parsades, beräkna
    if (result.totalTests === 0) {
      result.totalTests = result.passed + result.failed;
    }

    return result;
  }

  private extractErrorContext(lines: string[], failIndex: number): string {
    const context: string[] = [];
    for (let i = failIndex; i < Math.min(failIndex + 10, lines.length); i++) {
      context.push(lines[i]);
      if (lines[i].includes('Expected') || lines[i].includes('Received')) {
        // Inkludera expected/received
        if (i + 1 < lines.length) { context.push(lines[i + 1]); }
        break;
      }
    }
    return context.join('\n');
  }

  // ─── Fix Parsing ──────────────────────────

  private parseFixes(
    llmResponse: string
  ): Array<{ file: string; oldCode: string; newCode: string; reason: string }> {
    const fixes: Array<{ file: string; oldCode: string; newCode: string; reason: string }> = [];

    // Parsa FILE: / OLD: / NEW: / REASON: format
    const blocks = llmResponse.split(/(?=FILE:\s)/g);

    for (const block of blocks) {
      const fileMatch = block.match(/FILE:\s*(.+)/);
      const oldMatch = block.match(/OLD:\s*```[\w]*\n([\s\S]*?)```/);
      const newMatch = block.match(/NEW:\s*```[\w]*\n([\s\S]*?)```/);
      const reasonMatch = block.match(/REASON:\s*(.+)/);

      if (fileMatch && oldMatch && newMatch) {
        fixes.push({
          file: fileMatch[1].trim(),
          oldCode: oldMatch[1].trimEnd(),
          newCode: newMatch[1].trimEnd(),
          reason: reasonMatch?.[1]?.trim() ?? 'Fix applicerad',
        });
      }
    }

    return fixes;
  }

  // ─── Report Formatting ─────────────────────

  private formatTestReport(result: TestRunResult): string {
    const lines: string[] = [];
    const allPass = result.failed === 0;

    lines.push(`| Metriker | Värde |`);
    lines.push(`|----------|-------|`);
    lines.push(`| Ramverk | ${result.framework} |`);
    lines.push(`| Totalt | ${result.totalTests} |`);
    lines.push(`| ✅ Passerade | ${result.passed} |`);
    lines.push(`| ❌ Misslyckade | ${result.failed} |`);
    if (result.duration > 0) {
      lines.push(`| ⏱️ Tid | ${result.duration}s |`);
    }
    lines.push('');

    if (allPass) {
      lines.push('### ✅ Alla tester passerar!\n');
    } else {
      lines.push('### ❌ Misslyckade tester\n');
      for (const t of result.failedTests) {
        lines.push(`#### \`${t.name}\``);
        if (t.file) { lines.push(`📁 ${t.file}${t.line ? `:${t.line}` : ''}`); }
        lines.push('```');
        lines.push(t.error);
        lines.push('```\n');
      }
    }

    return lines.join('\n');
  }
}
