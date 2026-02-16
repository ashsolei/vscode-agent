import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from './workflow-engine';
import type { WorkflowDefinition, WorkflowStep, WorkflowStepResult } from './workflow-engine';
import { AgentRegistry } from '../agents/index';
import type { AgentContext, AgentResult } from '../agents/base-agent';

/**
 * Tester för WorkflowEngine — multi-agent-pipeline med
 * sekventiella steg, parallella grupper, villkor, retry och variabelsubstitution.
 */

// ─── Mock-helpers ───

function createMockRegistry(delegateImpl?: (agentId: string, ctx: any, prompt: string) => Promise<any>) {
  return {
    delegate: vi.fn(delegateImpl ?? (async (_id: string, _ctx: any, _prompt: string) => ({
      result: {},
      text: 'mock output',
    }))),
    get: vi.fn(),
    list: vi.fn(() => []),
  } as any;
}

function createMockContext(cancelled = false) {
  return {
    request: { prompt: 'test', command: undefined },
    chatContext: { history: [] },
    stream: {
      markdown: vi.fn(),
      progress: vi.fn(),
      reference: vi.fn(),
      button: vi.fn(),
      anchor: vi.fn(),
    },
    token: {
      isCancellationRequested: cancelled,
      onCancellationRequested: vi.fn(),
    },
  } as unknown as AgentContext;
}

function makeStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    name: 'steg-1',
    agentId: 'code',
    prompt: 'Gör något',
    ...overrides,
  };
}

function makeWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    name: 'Test Workflow',
    description: 'En test-workflow',
    steps: [makeStep()],
    ...overrides,
  };
}

function makeRealRegistry(...agents: Array<{ id: string; output: string }>): AgentRegistry {
  const registry = new AgentRegistry();
  for (const a of agents) {
    registry.register({
      id: a.id,
      name: `Agent ${a.id}`,
      description: `Test agent ${a.id}`,
      handle: vi.fn(async (ctx: AgentContext) => {
        ctx.stream.markdown(a.output);
        return { metadata: {} };
      }),
    } as any);
  }
  return registry;
}

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let registry: ReturnType<typeof createMockRegistry>;
  let ctx: AgentContext;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    engine = new WorkflowEngine(registry);
    ctx = createMockContext();
  });

  // ─── Grundläggande sekventiell exekvering ───

  describe('sekventiell exekvering', () => {
    it('kör ett enskilt steg och returnerar resultat', async () => {
      const wf = makeWorkflow();
      const results = await engine.run(wf, ctx);

      expect(results).toHaveLength(1);
      expect(results[0].stepName).toBe('steg-1');
      expect(results[0].agentId).toBe('code');
      expect(results[0].success).toBe(true);
      expect(results[0].skipped).toBe(false);
      expect(results[0].text).toBe('mock output');
      expect(registry.delegate).toHaveBeenCalledOnce();
    });

    it('kör flera steg sekventiellt i ordning', async () => {
      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'a', agentId: 'review' }),
          makeStep({ name: 'b', agentId: 'test' }),
          makeStep({ name: 'c', agentId: 'security' }),
        ],
      });

      const results = await engine.run(wf, ctx);

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.stepName)).toEqual(['a', 'b', 'c']);
      expect(registry.delegate).toHaveBeenCalledTimes(3);
    });

    it('sammanfattningen visar rätt antal lyckas/fail/hoppade-över', async () => {
      const wf = makeWorkflow({
        steps: [makeStep({ name: 'ok' })],
      });

      await engine.run(wf, ctx);

      const calls = ctx.stream.markdown.mock.calls;
      const summaryCall = calls[calls.length - 1][0];
      expect(summaryCall).toContain('1 lyckades');
      expect(summaryCall).toContain('0 hoppades över');
      expect(summaryCall).toContain('0 misslyckades');
    });

    it('med riktig AgentRegistry — kör steg i ordning', async () => {
      const realReg = makeRealRegistry(
        { id: 'step1', output: 'result-1' },
        { id: 'step2', output: 'result-2' }
      );
      const realEngine = new WorkflowEngine(realReg);

      const wf: WorkflowDefinition = {
        name: 'seq-test',
        description: 'Sequential test',
        steps: [
          { name: 'First', agentId: 'step1', prompt: 'go' },
          { name: 'Second', agentId: 'step2', prompt: 'go' },
        ],
      };

      const results = await realEngine.run(wf, ctx);
      expect(results).toHaveLength(2);
      expect(results[0].stepName).toBe('First');
      expect(results[0].success).toBe(true);
      expect(results[1].stepName).toBe('Second');
      expect(results[1].success).toBe(true);
    });
  });

  // ─── Variabelsubstitution ───

  describe('variabelsubstitution', () => {
    it('ersätter ${var} i prompt med workflow-variabler', async () => {
      const wf = makeWorkflow({
        variables: { feature: 'login-flöde' },
        steps: [makeStep({ prompt: 'Implementera ${feature} nu' })],
      });

      await engine.run(wf, ctx);

      const callArgs = registry.delegate.mock.calls[0];
      expect(callArgs[2]).toBe('Implementera login-flöde nu');
    });

    it('sparar stegoutput som variabel för framtida steg', async () => {
      registry = createMockRegistry(async (agentId: string) => ({
        result: {},
        text: agentId === 'review' ? 'review-output-text' : 'other',
      }));
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'review', agentId: 'review', prompt: 'Granska' }),
          makeStep({ name: 'code', agentId: 'code', prompt: 'Fix baserat på ${review}' }),
        ],
      });

      await engine.run(wf, ctx);

      const secondCallPrompt = registry.delegate.mock.calls[1][2];
      expect(secondCallPrompt).toBe('Fix baserat på review-output-text');
    });

    it('hanterar flera variabler i samma prompt', async () => {
      const wf = makeWorkflow({
        variables: { lang: 'TypeScript', scope: 'src/' },
        steps: [makeStep({ prompt: 'Koda i ${lang} under ${scope}' })],
      });

      await engine.run(wf, ctx);

      const callArgs = registry.delegate.mock.calls[0];
      expect(callArgs[2]).toBe('Koda i TypeScript under src/');
    });
  });

  // ─── Pipe output ───

  describe('pipeOutput', () => {
    it('lägger till föregående stegs output i prompten', async () => {
      registry = createMockRegistry(async () => ({
        result: {},
        text: 'föregående resultat',
      }));
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-a', prompt: 'Först' }),
          makeStep({ name: 'steg-b', prompt: 'Sedan', pipeOutput: true }),
        ],
      });

      await engine.run(wf, ctx);

      const secondCallPrompt = registry.delegate.mock.calls[1][2];
      expect(secondCallPrompt).toContain('Sedan');
      expect(secondCallPrompt).toContain('Tidigare output:');
      expect(secondCallPrompt).toContain('föregående resultat');
    });

    it('inkluderar inte pipe om pipeOutput är false', async () => {
      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-a', prompt: 'Först' }),
          makeStep({ name: 'steg-b', prompt: 'Sedan', pipeOutput: false }),
        ],
      });

      await engine.run(wf, ctx);

      const secondCallPrompt = registry.delegate.mock.calls[1][2];
      expect(secondCallPrompt).not.toContain('Tidigare output');
    });
  });

  // ─── Villkorsstyrd exekvering ───

  describe('villkor (condition)', () => {
    it('kör steg med condition succeeded när föregående lyckades', async () => {
      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-0' }),
          makeStep({ name: 'steg-1', condition: { ifStep: 0, is: 'succeeded' } }),
        ],
      });

      const results = await engine.run(wf, ctx);

      expect(results[1].skipped).toBe(false);
      expect(results[1].success).toBe(true);
    });

    it('hoppar över steg med condition succeeded när föregående misslyckades', async () => {
      registry = createMockRegistry(async () => {
        throw new Error('fail');
      });
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-0' }),
          makeStep({ name: 'steg-1', condition: { ifStep: 0, is: 'succeeded' } }),
        ],
      });

      const results = await engine.run(wf, ctx);

      expect(results[0].success).toBe(false);
      expect(results[1].skipped).toBe(true);
    });

    it('med riktig registry — hoppar över steg om villkor ej uppfyllt', async () => {
      const realReg = makeRealRegistry(
        { id: 'a', output: 'ok' },
        { id: 'b', output: 'never' }
      );
      const realEngine = new WorkflowEngine(realReg);

      const wf: WorkflowDefinition = {
        name: 'cond-test',
        description: 'Conditional test',
        steps: [
          { name: 'A', agentId: 'a', prompt: 'go' },
          { name: 'B', agentId: 'b', prompt: 'go', condition: { ifStep: 0, is: 'failed' } },
        ],
      };

      const results = await realEngine.run(wf, ctx);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].skipped).toBe(true);
    });

    it('kör steg med condition failed när föregående misslyckades', async () => {
      registry = createMockRegistry(async () => {
        throw new Error('expected fail');
      });
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-0' }),
          makeStep({ name: 'steg-1', condition: { ifStep: 0, is: 'failed' } }),
        ],
      });

      const results = await engine.run(wf, ctx);

      expect(results[0].success).toBe(false);
      expect(results[1].skipped).toBe(false);
    });

    it('kör steg med condition contains om texten matchar', async () => {
      registry = createMockRegistry(async () => ({
        result: {},
        text: 'det finns ERRORs i koden',
      }));
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-0' }),
          makeStep({
            name: 'steg-1',
            condition: { ifStep: 0, is: 'contains', value: 'ERROR' },
          }),
        ],
      });

      const results = await engine.run(wf, ctx);
      expect(results[1].skipped).toBe(false);
    });

    it('hoppar över steg med condition contains om texten inte matchar', async () => {
      registry = createMockRegistry(async () => ({
        result: {},
        text: 'allt ser bra ut',
      }));
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-0' }),
          makeStep({
            name: 'steg-1',
            condition: { ifStep: 0, is: 'contains', value: 'ERROR' },
          }),
        ],
      });

      const results = await engine.run(wf, ctx);
      expect(results[1].skipped).toBe(true);
    });

    it('kör steg om ifStep pekar bortom tillgängliga resultat', async () => {
      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-0', condition: { ifStep: 99, is: 'succeeded' } }),
        ],
      });

      const results = await engine.run(wf, ctx);
      expect(results[0].skipped).toBe(false);
    });

    it('kör steg om ifStep är undefined', async () => {
      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-0', condition: { is: 'succeeded' } }),
        ],
      });

      const results = await engine.run(wf, ctx);
      expect(results[0].skipped).toBe(false);
    });

    it('hanterar contains utan value som falskt', async () => {
      registry = createMockRegistry(async () => ({
        result: {},
        text: 'anything',
      }));
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'steg-0' }),
          makeStep({
            name: 'steg-1',
            condition: { ifStep: 0, is: 'contains' },
          }),
        ],
      });

      const results = await engine.run(wf, ctx);
      expect(results[1].skipped).toBe(true);
    });
  });

  // ─── Retry-logik ───

  describe('retry', () => {
    it('försöker igen vid fel och lyckas till slut', async () => {
      let attempts = 0;
      registry = createMockRegistry(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('temporärt fel');
        }
        return { result: {}, text: 'ok till slut' };
      });
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [makeStep({ name: 'retry-step', retries: 2 })],
      });

      const results = await engine.run(wf, ctx);

      expect(results[0].success).toBe(true);
      expect(results[0].retries).toBe(2);
      expect(results[0].text).toBe('ok till slut');
    });

    it('misslyckas efter alla retries förbrukats', async () => {
      registry = createMockRegistry(async () => {
        throw new Error('permanent fel');
      });
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [makeStep({ name: 'fail-step', retries: 1 })],
      });

      const results = await engine.run(wf, ctx);

      expect(results[0].success).toBe(false);
      expect(results[0].retries).toBe(1);
      expect(results[0].text).toContain('FEL: permanent fel');
    });

    it('kör utan retry om retries ej satt', async () => {
      registry = createMockRegistry(async () => {
        throw new Error('direkt-fel');
      });
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [makeStep({ name: 'no-retry' })],
      });

      const results = await engine.run(wf, ctx);

      expect(results[0].success).toBe(false);
      expect(results[0].retries).toBe(0);
    });

    // ─── v0.10.0: cancellation during retry ───

    it('stoppar retry-loop om cancellation begärs', async () => {
      let attempts = 0;
      const cancelToken = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      };

      registry = createMockRegistry(async () => {
        attempts++;
        // Trigger cancellation after first failed attempt
        cancelToken.isCancellationRequested = true;
        throw new Error('retry-fel');
      });
      engine = new WorkflowEngine(registry);

      const cancelCtx = {
        request: { prompt: 'test', command: undefined },
        chatContext: { history: [] },
        stream: {
          markdown: vi.fn(),
          progress: vi.fn(),
          reference: vi.fn(),
          button: vi.fn(),
          anchor: vi.fn(),
        },
        token: cancelToken,
      } as unknown as AgentContext;

      const wf = makeWorkflow({
        steps: [makeStep({ name: 'cancel-retry', retries: 5 })],
      });

      const results = await engine.run(wf, cancelCtx);

      // First attempt fails, sets cancel flag. Retry loop checks cancel at top
      // of next iteration and returns skipped result.
      const step = results.find(r => r.stepName === 'cancel-retry');
      expect(step).toBeDefined();
      expect(step!.skipped).toBe(true);
      expect(step!.success).toBe(false);
      // Should only have 1 delegate call (the failed one that set cancel)
      expect(attempts).toBe(1);
    });
  });

  // ─── Parallella grupper ───

  describe('parallella grupper', () => {
    it('kör steg med samma parallelGroup parallellt', async () => {
      registry = createMockRegistry(async (agentId: string) => ({
        result: {},
        text: `${agentId}-output`,
      }));
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'sec', agentId: 'security', parallelGroup: 'analysis' }),
          makeStep({ name: 'perf', agentId: 'perf', parallelGroup: 'analysis' }),
        ],
      });

      const results = await engine.run(wf, ctx);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(registry.delegate).toHaveBeenCalledTimes(2);
    });

    it('hanterar fel i en parallelgrupp utan att stoppa andra', async () => {
      registry = createMockRegistry(async (agentId: string) => {
        if (agentId === 'security') {
          throw new Error('security-crash');
        }
        return { result: {}, text: 'ok' };
      });
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'sec', agentId: 'security', parallelGroup: 'grp' }),
          makeStep({ name: 'perf', agentId: 'perf', parallelGroup: 'grp' }),
        ],
      });

      const results = await engine.run(wf, ctx);

      expect(results).toHaveLength(2);
      const secResult = results.find((r) => r.agentId === 'security')!;
      expect(secResult.success).toBe(false);
      expect(secResult.text).toContain('security-crash');
      const perfResult = results.find((r) => r.agentId === 'perf')!;
      expect(perfResult.success).toBe(true);
    });

    it('blandar sekventiella och parallella steg', async () => {
      const wf = makeWorkflow({
        steps: [
          makeStep({ name: 'seq-1', agentId: 'review' }),
          makeStep({ name: 'par-a', agentId: 'security', parallelGroup: 'p' }),
          makeStep({ name: 'par-b', agentId: 'perf', parallelGroup: 'p' }),
          makeStep({ name: 'seq-2', agentId: 'test' }),
        ],
      });

      const results = await engine.run(wf, ctx);

      expect(results).toHaveLength(4);
      expect(results.map((r) => r.stepName)).toEqual(['seq-1', 'par-a', 'par-b', 'seq-2']);
    });

    it('med riktig registry — parallella steg körs samtidigt', async () => {
      const realReg = makeRealRegistry(
        { id: 'p1', output: 'parallel-1' },
        { id: 'p2', output: 'parallel-2' }
      );
      const realEngine = new WorkflowEngine(realReg);

      const wf: WorkflowDefinition = {
        name: 'parallel-test',
        description: 'Parallel test',
        steps: [
          { name: 'P1', agentId: 'p1', prompt: 'go', parallelGroup: 'batch' },
          { name: 'P2', agentId: 'p2', prompt: 'go', parallelGroup: 'batch' },
        ],
      };

      const results = await realEngine.run(wf, ctx);
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.success).toBe(true);
      }
    });
  });

  // ─── Avbrytning (cancellation) ───

  describe('cancellation', () => {
    it('avbryter workflow om token är cancelled', async () => {
      ctx = createMockContext(true);

      const wf = makeWorkflow({
        steps: [makeStep(), makeStep({ name: 'steg-2' })],
      });

      const results = await engine.run(wf, ctx);

      expect(results).toHaveLength(0);
      expect(registry.delegate).not.toHaveBeenCalled();
      expect(ctx.stream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('avbruten')
      );
    });
  });

  // ─── Felhantering ───

  describe('felhantering', () => {
    it('hanterar icke-Error-undantag i steg', async () => {
      registry = createMockRegistry(async () => {
        throw 'string error';
      });
      engine = new WorkflowEngine(registry);

      const wf = makeWorkflow();
      const results = await engine.run(wf, ctx);

      expect(results[0].success).toBe(false);
      expect(results[0].text).toContain('string error');
    });

    it('mäter durationMs för lyckade steg', async () => {
      const wf = makeWorkflow();
      const results = await engine.run(wf, ctx);

      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('med riktig registry — hanterar saknad agent', async () => {
      const realReg = makeRealRegistry();
      const realEngine = new WorkflowEngine(realReg);

      const wf: WorkflowDefinition = {
        name: 'miss-test',
        description: 'Missing agent test',
        steps: [{ name: 'Missing', agentId: 'nonexistent', prompt: 'go' }],
      };

      const results = await realEngine.run(wf, ctx);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });
  });

  // ─── Fördefinierade workflows ───

  describe('fördefinierade workflows', () => {
    it('qualityCheck har rätt struktur', () => {
      const wf = WorkflowEngine.qualityCheck();
      expect(wf.name).toBe('Full Quality Check');
      expect(wf.steps).toHaveLength(4);
      expect(wf.steps[2].parallelGroup).toBe('analysis');
      expect(wf.steps[3].parallelGroup).toBe('analysis');
    });

    it('shipFeature inkluderar feature-variabel', () => {
      const wf = WorkflowEngine.shipFeature('ny login-sida');
      expect(wf.name).toBe('Ship Feature');
      expect(wf.variables?.feature).toBe('ny login-sida');
      expect(wf.steps.length).toBeGreaterThan(3);
      expect(wf.steps.some((s) => s.pipeOutput)).toBe(true);
    });

    it('fixAndVerify har villkorsstyrda steg', () => {
      const wf = WorkflowEngine.fixAndVerify();
      expect(wf.name).toBe('Fix & Verify');
      expect(wf.steps[0].retries).toBe(2);
      expect(wf.steps[1].condition?.ifStep).toBe(0);
      expect(wf.steps[1].condition?.is).toBe('succeeded');
      expect(wf.steps[2].condition?.ifStep).toBe(1);
    });
  });

  // ─── Edge cases ───

  describe('edge cases', () => {
    it('hanterar tom steg-lista', async () => {
      const wf = makeWorkflow({ steps: [] });
      const results = await engine.run(wf, ctx);

      expect(results).toHaveLength(0);
    });

    it('visar workflow-namn i header-markdown', async () => {
      const wf = makeWorkflow({ name: 'Min Workflow', description: 'Beskrivning' });
      await engine.run(wf, ctx);

      expect(ctx.stream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('Min Workflow')
      );
    });

    it('workflow utan variables-objekt fungerar', async () => {
      const wf: WorkflowDefinition = {
        name: 'Utan variabler',
        description: 'Inga variabler',
        steps: [makeStep({ prompt: 'Bara en prompt' })],
      };

      const results = await engine.run(wf, ctx);
      expect(results[0].success).toBe(true);
    });
  });

  // ─── Custom workflows (registrering) ───

  describe('custom workflows', () => {
    it('registerWorkflow sparar och getWorkflow hämtar', () => {
      const wf = makeWorkflow({ name: 'my-wf' });
      engine.registerWorkflow('my-wf', wf);

      const retrieved = engine.getWorkflow('my-wf');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('my-wf');
    });

    it('listWorkflows returnerar alla registrerade namn', () => {
      engine.registerWorkflow('wf-a', makeWorkflow({ name: 'wf-a' }));
      engine.registerWorkflow('wf-b', makeWorkflow({ name: 'wf-b' }));
      engine.registerWorkflow('wf-c', makeWorkflow({ name: 'wf-c' }));

      const names = engine.listWorkflows();
      expect(names).toHaveLength(3);
      expect(names).toContain('wf-a');
      expect(names).toContain('wf-b');
      expect(names).toContain('wf-c');
    });

    it('removeWorkflow tar bort en enskild workflow', () => {
      engine.registerWorkflow('remove-me', makeWorkflow({ name: 'remove-me' }));
      expect(engine.listWorkflows()).toContain('remove-me');

      const removed = engine.removeWorkflow('remove-me');
      expect(removed).toBe(true);
      expect(engine.getWorkflow('remove-me')).toBeUndefined();
    });

    it('removeWorkflow returnerar false om workflow inte finns', () => {
      expect(engine.removeWorkflow('nonexistent')).toBe(false);
    });

    it('clearWorkflows rensar alla custom workflows', () => {
      engine.registerWorkflow('a', makeWorkflow({ name: 'a' }));
      engine.registerWorkflow('b', makeWorkflow({ name: 'b' }));
      expect(engine.listWorkflows()).toHaveLength(2);

      engine.clearWorkflows();
      expect(engine.listWorkflows()).toHaveLength(0);
    });

    it('registerWorkflow skriver över existerande med samma namn', () => {
      const wf1 = makeWorkflow({ name: 'dup', description: 'first' });
      const wf2 = makeWorkflow({ name: 'dup', description: 'second' });

      engine.registerWorkflow('dup', wf1);
      engine.registerWorkflow('dup', wf2);

      expect(engine.listWorkflows()).toHaveLength(1);
      expect(engine.getWorkflow('dup')!.description).toBe('second');
    });

    it('getWorkflow returnerar undefined för okänd workflow', () => {
      expect(engine.getWorkflow('unknown')).toBeUndefined();
    });

    it('registrerad custom workflow kan köras via run()', async () => {
      const wf = makeWorkflow({
        name: 'runnable',
        steps: [makeStep({ name: 'step1', agentId: 'code', prompt: 'Hello' })],
      });

      engine.registerWorkflow('runnable', wf);
      const retrieved = engine.getWorkflow('runnable')!;
      const results = await engine.run(retrieved, ctx);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });
});
