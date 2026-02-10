import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from './workflow-engine';
import type { WorkflowDefinition, WorkflowStepResult } from './workflow-engine';
import { AgentRegistry } from '../agents/index';
import type { AgentContext, AgentResult } from '../agents/base-agent';

// --- Helpers ---

function makeCtx(): AgentContext {
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
    token: { isCancellationRequested: false, onCancellationRequested: vi.fn() },
  } as unknown as AgentContext;
}

function makeRegistry(...agents: Array<{ id: string; output: string }>): AgentRegistry {
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

// --- Tests ---

describe('WorkflowEngine', () => {
  it('executes sequential steps in order', async () => {
    const registry = makeRegistry(
      { id: 'step1', output: 'result-1' },
      { id: 'step2', output: 'result-2' }
    );

    const engine = new WorkflowEngine(registry);

    const wf: WorkflowDefinition = {
      name: 'seq-test',
      description: 'Sequential test',
      steps: [
        { name: 'First', agentId: 'step1', prompt: 'go' },
        { name: 'Second', agentId: 'step2', prompt: 'go' },
      ],
    };

    const results = await engine.run(wf, makeCtx());

    expect(results).toHaveLength(2);
    expect(results[0].stepName).toBe('First');
    expect(results[0].success).toBe(true);
    expect(results[1].stepName).toBe('Second');
    expect(results[1].success).toBe(true);
  });

  it('skips step when condition is not met', async () => {
    const registry = makeRegistry(
      { id: 'a', output: 'ok' },
      { id: 'b', output: 'never' }
    );

    const engine = new WorkflowEngine(registry);

    const wf: WorkflowDefinition = {
      name: 'cond-test',
      description: 'Conditional test',
      steps: [
        { name: 'A', agentId: 'a', prompt: 'go' },
        {
          name: 'B',
          agentId: 'b',
          prompt: 'go',
          condition: { ifStep: 0, is: 'failed' },
        },
      ],
    };

    const results = await engine.run(wf, makeCtx());

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].skipped).toBe(true);
  });

  it('handles agent not found gracefully', async () => {
    const registry = makeRegistry(); // empty
    const engine = new WorkflowEngine(registry);

    const wf: WorkflowDefinition = {
      name: 'miss-test',
      description: 'Missing agent test',
      steps: [
        { name: 'Missing', agentId: 'nonexistent', prompt: 'go' },
      ],
    };

    const results = await engine.run(wf, makeCtx());

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });

  it('executes parallel group steps concurrently', async () => {
    const registry = makeRegistry(
      { id: 'p1', output: 'parallel-1' },
      { id: 'p2', output: 'parallel-2' }
    );

    const engine = new WorkflowEngine(registry);

    const wf: WorkflowDefinition = {
      name: 'parallel-test',
      description: 'Parallel test',
      steps: [
        { name: 'P1', agentId: 'p1', prompt: 'go', parallelGroup: 'batch' },
        { name: 'P2', agentId: 'p2', prompt: 'go', parallelGroup: 'batch' },
      ],
    };

    const results = await engine.run(wf, makeCtx());

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.success).toBe(true);
    }
  });
});
