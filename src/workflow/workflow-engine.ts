import { AgentRegistry } from '../agents/index';
import { AgentContext } from '../agents/base-agent';

/**
 * En villkorsregel som avgör om ett steg ska köras.
 */
export interface WorkflowCondition {
  /** Refererar till ett tidigare steg via index */
  ifStep?: number;
  /** 'succeeded' | 'failed' | 'contains' */
  is: 'succeeded' | 'failed' | 'contains';
  /** Vid 'contains' — sök efter denna sträng i outputen */
  value?: string;
}

/**
 * Ett steg i en workflow.
 */
export interface WorkflowStep {
  name: string;
  agentId: string;
  prompt: string;
  /** Pipe output från föregående steg som kontext */
  pipeOutput?: boolean;
  /** Villkor för att köra detta steg */
  condition?: WorkflowCondition;
  /** Kör parallellt med nästa steg(en) som har samma group-id */
  parallelGroup?: string;
  /** Antal gånger att retry vid fel */
  retries?: number;
}

/**
 * En komplett workflow-definition.
 */
export interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
  /** Globala variabler tillgängliga i alla steg */
  variables?: Record<string, string>;
}

/**
 * Resultat från ett exekverat workflow-steg.
 */
export interface WorkflowStepResult {
  stepName: string;
  agentId: string;
  text: string;
  success: boolean;
  skipped: boolean;
  durationMs: number;
  retries: number;
}

/**
 * WorkflowEngine — kör multi-agent-pipelines definierade som JSON.
 *
 * Stöder:
 * - Sekventiella steg
 * - Parallella grupper
 * - Villkorsstyrd exekvering
 * - Retry-logik
 * - Variabelsubstitution
 * - Output-piping mellan steg
 */
export class WorkflowEngine {
  private customWorkflows = new Map<string, WorkflowDefinition>();

  constructor(private registry: AgentRegistry) {}

  /**
   * Registrera en namngiven custom workflow.
   * Överskriver befintlig workflow med samma namn.
   */
  registerWorkflow(name: string, wf: WorkflowDefinition): void {
    this.customWorkflows.set(name, wf);
  }

  /**
   * Hämta en registrerad custom workflow via namn.
   */
  getWorkflow(name: string): WorkflowDefinition | undefined {
    return this.customWorkflows.get(name);
  }

  /**
   * Lista alla registrerade custom workflow-namn.
   */
  listWorkflows(): string[] {
    return [...this.customWorkflows.keys()];
  }

  /**
   * Ta bort en registrerad custom workflow.
   */
  removeWorkflow(name: string): boolean {
    return this.customWorkflows.delete(name);
  }

  /**
   * Rensa alla custom workflows.
   */
  clearWorkflows(): void {
    this.customWorkflows.clear();
  }

  /**
   * Kör en workflow.
   */
  async run(
    wf: WorkflowDefinition,
    ctx: AgentContext
  ): Promise<WorkflowStepResult[]> {
    const results: WorkflowStepResult[] = [];
    const variables = { ...wf.variables };

    ctx.stream.markdown(
      `\n## 🔄 Workflow: ${wf.name}\n${wf.description}\n\n---\n`
    );

    let i = 0;
    while (i < wf.steps.length) {
      // Kontrollera om användaren avbrutit
      if (ctx.token.isCancellationRequested) {
        ctx.stream.markdown('\n⏹️ Workflow avbruten av användaren.\n');
        break;
      }

      // Samla steg i samma parallelGroup
      const step = wf.steps[i];
      if (step.parallelGroup) {
        const group: WorkflowStep[] = [];
        const groupId = step.parallelGroup;
        while (i < wf.steps.length && wf.steps[i].parallelGroup === groupId) {
          group.push(wf.steps[i]);
          i++;
        }

        ctx.stream.markdown(`\n### ⚡ Parallell grupp: ${groupId}\n`);

        const parallelResults = await Promise.allSettled(
          group.map((s) =>
            this.runStep(s, ctx, results, variables)
          )
        );

        for (let j = 0; j < parallelResults.length; j++) {
          const pr = parallelResults[j];
          if (pr.status === 'fulfilled') {
            results.push(pr.value);
          } else {
            const failedStep = group[j];
            results.push({
              stepName: failedStep?.name ?? 'unknown',
              agentId: failedStep?.agentId ?? 'unknown',
              text: `FEL: ${pr.reason instanceof Error ? pr.reason.message : String(pr.reason)}`,
              success: false,
              skipped: false,
              durationMs: 0,
              retries: 0,
            });
          }
        }
      } else {
        const result = await this.runStep(step, ctx, results, variables);
        results.push(result);
        i++;
      }
    }

    // Sammanfattning
    const ok = results.filter((r) => r.success).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success && !r.skipped).length;
    const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

    ctx.stream.markdown(
      `\n---\n### 🏁 Workflow klar\n` +
      `✅ ${ok} lyckades · ⏭️ ${skipped} hoppades över · ❌ ${failed} misslyckades · ⏱️ ${totalMs}ms\n`
    );

    return results;
  }

  /**
   * Kör ett enskilt steg med retry och villkor.
   */
  private async runStep(
    step: WorkflowStep,
    ctx: AgentContext,
    previousResults: WorkflowStepResult[],
    variables: Record<string, string>
  ): Promise<WorkflowStepResult> {
    // Kolla villkor
    if (step.condition) {
      const shouldRun = this.evaluateCondition(step.condition, previousResults);
      if (!shouldRun) {
        ctx.stream.markdown(`⏭️ **${step.name}** — villkor ej uppfyllt, hoppas över\n`);
        return {
          stepName: step.name,
          agentId: step.agentId,
          text: '',
          success: true,
          skipped: true,
          durationMs: 0,
          retries: 0,
        };
      }
    }

    // Variabelsubstitution i prompten
    let prompt = step.prompt;
    for (const [key, val] of Object.entries(variables)) {
      // Escape regex metacharacters in key to prevent injection
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      prompt = prompt.replace(new RegExp(`\\$\\{${escapedKey}\\}`, 'g'), val);
    }

    // Pipe output från föregående steg
    if (step.pipeOutput && previousResults.length > 0) {
      const lastOutput = previousResults[previousResults.length - 1].text;
      prompt = `${prompt}\n\n---\nTidigare output:\n${lastOutput}`;
    }

    // Retry-logik
    const maxRetries = step.retries ?? 0;
    let lastError = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (ctx.token.isCancellationRequested) {
        return {
          stepName: step.name,
          agentId: step.agentId,
          text: '',
          success: false,
          skipped: true,
          durationMs: 0,
          retries: attempt,
        };
      }
      const startTime = Date.now();

      try {
        ctx.stream.markdown(`\n▶ **${step.name}** (${step.agentId})${attempt > 0 ? ` — retry ${attempt}` : ''}\n\n`);

        const { text } = await this.registry.delegate(step.agentId, ctx, prompt);

        // Spara output som variabel för framtida steg
        variables[step.name] = text;

        return {
          stepName: step.name,
          agentId: step.agentId,
          text,
          success: true,
          skipped: false,
          durationMs: Date.now() - startTime,
          retries: attempt,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < maxRetries) {
          ctx.stream.markdown(`⚠️ Fel i ${step.name}, försöker igen...\n`);
        }
      }
    }

    return {
      stepName: step.name,
      agentId: step.agentId,
      text: `FEL: ${lastError}`,
      success: false,
      skipped: false,
      durationMs: 0,
      retries: maxRetries,
    };
  }

  /**
   * Utvärdera ett villkor baserat på tidigare stegs resultat.
   */
  private evaluateCondition(
    cond: WorkflowCondition,
    results: WorkflowStepResult[]
  ): boolean {
    if (cond.ifStep === undefined || cond.ifStep >= results.length) {
      return true; // Inget villkor att utvärdera
    }

    const target = results[cond.ifStep];

    switch (cond.is) {
      case 'succeeded':
        return target.success;
      case 'failed':
        return !target.success;
      case 'contains':
        return cond.value ? target.text.includes(cond.value) : false;
      default:
        return true;
    }
  }

  // ─────────────────────────────────────────────────────
  //  Fördefinierade workflows
  // ─────────────────────────────────────────────────────

  /**
   * Inbyggd workflow: "Full Quality Check"
   * review → test → security → perf
   */
  static qualityCheck(): WorkflowDefinition {
    return {
      name: 'Full Quality Check',
      description: 'Kör kodgranskning, tester, säkerhet och prestandaanalys.',
      steps: [
        { name: 'review', agentId: 'review', prompt: 'Granska koden i den aktiva filen.' },
        { name: 'test', agentId: 'test', prompt: 'Generera tester baserat på granskningen.', pipeOutput: true },
        { name: 'security', agentId: 'security', prompt: 'Analysera säkerhetsproblem.', parallelGroup: 'analysis' },
        { name: 'perf', agentId: 'perf', prompt: 'Analysera prestandaproblem.', parallelGroup: 'analysis' },
      ],
    };
  }

  /**
   * Inbyggd workflow: "Ship Feature"
   * plan → scaffold → code → test → docgen → review
   */
  static shipFeature(featureDescription: string): WorkflowDefinition {
    return {
      name: 'Ship Feature',
      description: `Bygg, testa och dokumentera: ${featureDescription}`,
      variables: { feature: featureDescription },
      steps: [
        { name: 'plan', agentId: 'plan', prompt: 'Skapa en plan för att implementera: ${feature}' },
        { name: 'scaffold', agentId: 'scaffold', prompt: 'Scaffolda filstrukturen.', pipeOutput: true },
        { name: 'code', agentId: 'code', prompt: 'Implementera koden.', pipeOutput: true },
        { name: 'test', agentId: 'test', prompt: 'Skriv tester.', pipeOutput: true },
        { name: 'docs', agentId: 'docgen', prompt: 'Generera dokumentation.', pipeOutput: true },
        { name: 'review', agentId: 'review', prompt: 'Slutgranskning.', pipeOutput: true, retries: 1 },
      ],
    };
  }

  /**
   * Inbyggd workflow: "Fix & Verify"
   * autofix → test → security
   */
  static fixAndVerify(): WorkflowDefinition {
    return {
      name: 'Fix & Verify',
      description: 'Fixa alla fel, kör tester, verifiera säkerhet.',
      steps: [
        { name: 'fix', agentId: 'autofix', prompt: 'Fixa alla diagnostiserror i projektet.', retries: 2 },
        { name: 'test', agentId: 'test', prompt: 'Kör tester efter fixarna.', pipeOutput: true,
          condition: { ifStep: 0, is: 'succeeded' } },
        { name: 'security', agentId: 'security', prompt: 'Säkerhetskontroll efter fixar.',
          condition: { ifStep: 1, is: 'succeeded' } },
      ],
    };
  }
}
