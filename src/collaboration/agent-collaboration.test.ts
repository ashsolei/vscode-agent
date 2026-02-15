import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentCollaboration, CollaborationResult } from './agent-collaboration';
import { AgentRegistry } from '../agents';
import type { AgentContext, AgentResult } from '../agents/base-agent';
import { BaseAgent } from '../agents/base-agent';

// ─── Helpers ──────────────────────────────────────────

/**
 * Concrete test agent that captures text written to the stream.
 */
class StubAgent extends BaseAgent {
  public handleImpl: (ctx: AgentContext) => Promise<AgentResult>;

  constructor(id: string, name: string, handleFn?: (ctx: AgentContext) => Promise<AgentResult>) {
    super(id, name, `Stub agent ${name}`);
    this.handleImpl = handleFn ?? (async (ctx) => {
      ctx.stream.markdown(`Response from ${name}`);
      return {};
    });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    return this.handleImpl(ctx);
  }
}

/**
 * Creates a minimal AgentContext with mocked stream, request, and model.
 * The model.sendRequest mock returns an async‑iterable `text` property so
 * that judge / consensus synthesis loops work.
 */
function createMockContext(prompt = 'Test question'): AgentContext {
  const stream = {
    markdown: vi.fn(),
    progress: vi.fn(),
    anchor: vi.fn(),
    button: vi.fn(),
    filetree: vi.fn(),
    reference: vi.fn(),
  } as unknown as import('vscode').ChatResponseStream;

  const asyncTextIterable = {
    async *[Symbol.asyncIterator]() {
      yield 'VINNARE: AgentA\nMOTIVERING: Best answer\nÖVERENSSTÄMMELSE: 0.8';
    },
    // The source iterates over response.text directly
    text: undefined as any,
  };
  asyncTextIterable.text = asyncTextIterable;

  const model = {
    sendRequest: vi.fn().mockResolvedValue(asyncTextIterable),
  };

  const request = {
    prompt,
    command: undefined as string | undefined,
    model,
    references: [],
  } as unknown as import('vscode').ChatRequest;

  const chatContext = {
    history: [],
  } as unknown as import('vscode').ChatContext;

  const token = {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn(),
  } as unknown as import('vscode').CancellationToken;

  return { request, chatContext, stream, token };
}

/**
 * Build and return a registry with zero or more pre‑registered stub agents.
 */
function buildRegistry(
  agents: StubAgent[] = []
): AgentRegistry {
  const registry = new AgentRegistry();
  for (const a of agents) {
    registry.register(a);
  }
  return registry;
}

// ─── Tests ────────────────────────────────────────────

describe('AgentCollaboration', () => {

  // ────────── Constructor ──────────

  describe('constructor', () => {
    it('should create an instance with a registry', () => {
      const registry = buildRegistry();
      const collab = new AgentCollaboration(registry);
      expect(collab).toBeInstanceOf(AgentCollaboration);
    });
  });

  // ────────── vote() ──────────

  describe('vote()', () => {
    let collab: AgentCollaboration;
    let ctx: AgentContext;
    let agentA: StubAgent;
    let agentB: StubAgent;

    beforeEach(() => {
      agentA = new StubAgent('a', 'AgentA');
      agentB = new StubAgent('b', 'AgentB');
      const registry = buildRegistry([agentA, agentB]);
      collab = new AgentCollaboration(registry);
      ctx = createMockContext();
    });

    it('should return a result with votes from all agents', async () => {
      const result = await collab.vote(['a', 'b'], ctx);
      expect(result.votes).toHaveLength(2);
      expect(result.votes[0].agentId).toBe('a');
      expect(result.votes[1].agentId).toBe('b');
    });

    it('should populate the question field from the request prompt', async () => {
      const result = await collab.vote(['a'], ctx);
      expect(result.question).toBe('Test question');
    });

    it('should capture agent responses', async () => {
      const result = await collab.vote(['a', 'b'], ctx);
      expect(result.votes[0].response).toContain('Response from AgentA');
      expect(result.votes[1].response).toContain('Response from AgentB');
    });

    it('should select a winner via the LLM judge', async () => {
      const result = await collab.vote(['a', 'b'], ctx);
      expect(result.winner).not.toBeNull();
      // The mock judge text contains "VINNARE: AgentA"
      expect(result.winner!.agentName).toBe('AgentA');
    });

    it('should include an agreementLevel between 0 and 1', async () => {
      const result = await collab.vote(['a', 'b'], ctx);
      expect(result.agreementLevel).toBeGreaterThanOrEqual(0);
      expect(result.agreementLevel).toBeLessThanOrEqual(1);
    });

    it('should track totalDuration', async () => {
      const result = await collab.vote(['a', 'b'], ctx);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should measure per‑vote duration', async () => {
      const result = await collab.vote(['a'], ctx);
      expect(result.votes[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should write headers to the stream', async () => {
      await collab.vote(['a', 'b'], ctx);
      const md = ctx.stream.markdown as ReturnType<typeof vi.fn>;
      const calls = md.mock.calls.map((c: any[]) => String(c[0]));
      expect(calls.some((c: string) => c.includes('omröstning'))).toBe(true);
    });

    // ── edge cases ──

    it('should handle empty agent list', async () => {
      const result = await collab.vote([], ctx);
      expect(result.votes).toHaveLength(0);
      expect(result.winner).toBeNull();
      expect(result.consensus).toBe('');
      expect(result.agreementLevel).toBe(0);
    });

    it('should skip unknown agent IDs gracefully', async () => {
      const result = await collab.vote(['nonexistent', 'a'], ctx);
      // Only agent 'a' exists — 'nonexistent' is silently skipped
      expect(result.votes).toHaveLength(1);
      expect(result.votes[0].agentId).toBe('a');
    });

    it('should handle a single agent', async () => {
      const result = await collab.vote(['a'], ctx);
      expect(result.votes).toHaveLength(1);
      expect(result.winner).not.toBeNull();
    });

    it('should survive an agent that throws', async () => {
      const failing = new StubAgent('fail', 'FailAgent', async () => {
        throw new Error('boom');
      });
      const registry = buildRegistry([agentA, failing]);
      collab = new AgentCollaboration(registry);

      const result = await collab.vote(['a', 'fail'], ctx);
      // FailAgent vote is dropped; AgentA vote remains
      expect(result.votes).toHaveLength(1);
      expect(result.votes[0].agentId).toBe('a');
    });

    it('should return empty result when all agents fail', async () => {
      const fail1 = new StubAgent('f1', 'Fail1', async () => { throw new Error('e1'); });
      const fail2 = new StubAgent('f2', 'Fail2', async () => { throw new Error('e2'); });
      const registry = buildRegistry([fail1, fail2]);
      collab = new AgentCollaboration(registry);

      const result = await collab.vote(['f1', 'f2'], ctx);
      expect(result.votes).toHaveLength(0);
      expect(result.winner).toBeNull();
    });

    it('should estimate confidence heuristically', async () => {
      const longAgent = new StubAgent('long', 'LongAgent', async (c) => {
        // Long response with code block → higher confidence
        c.stream.markdown('x'.repeat(2000) + '\n```js\nconsole.log();\n```');
        return {};
      });
      const shortAgent = new StubAgent('short', 'ShortAgent', async (c) => {
        c.stream.markdown('kanske');
        return {};
      });
      const registry = buildRegistry([longAgent, shortAgent]);
      collab = new AgentCollaboration(registry);

      const result = await collab.vote(['long', 'short'], ctx);
      const longVote = result.votes.find(v => v.agentId === 'long')!;
      const shortVote = result.votes.find(v => v.agentId === 'short')!;
      // Long response with code blocks should have higher confidence
      expect(longVote.confidence).toBeGreaterThan(shortVote.confidence);
    });
  });

  // ────────── debate() ──────────

  describe('debate()', () => {
    let collab: AgentCollaboration;
    let ctx: AgentContext;
    let agentA: StubAgent;
    let agentB: StubAgent;

    beforeEach(() => {
      agentA = new StubAgent('a', 'AgentA');
      agentB = new StubAgent('b', 'AgentB');
      const registry = buildRegistry([agentA, agentB]);
      collab = new AgentCollaboration(registry);
      ctx = createMockContext();
    });

    it('should execute the default 2 rounds of debate', async () => {
      const handleSpy = vi.spyOn(agentA, 'handle');
      const result = await collab.debate(['a', 'b'], ctx);

      expect(result.votes).toHaveLength(2);
      // Round 1 (collectVotes) + Round 2 (debate loop) = at least 2 calls per agent
      expect(handleSpy).toHaveBeenCalledTimes(2);
    });

    it('should return a result with populated fields', async () => {
      const result = await collab.debate(['a', 'b'], ctx);
      expect(result.question).toBe('Test question');
      expect(result.votes.length).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.winner).not.toBeNull();
    });

    it('should support custom number of rounds', async () => {
      const handleSpy = vi.spyOn(agentA, 'handle');
      await collab.debate(['a'], ctx, 3);
      // round 1 collectVotes + round 2 + round 3 = 3 calls
      expect(handleSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle debate with a single agent', async () => {
      const result = await collab.debate(['a'], ctx, 2);
      expect(result.votes).toHaveLength(1);
    });

    it('should survive an agent failure during debate rounds', async () => {
      let callCount = 0;
      const flaky = new StubAgent('flaky', 'FlakyAgent', async (c) => {
        callCount++;
        if (callCount > 1) { throw new Error('flaky failure'); }
        c.stream.markdown('First round OK');
        return {};
      });
      const registry = buildRegistry([agentA, flaky]);
      collab = new AgentCollaboration(registry);

      const result = await collab.debate(['a', 'flaky'], ctx, 2);
      // Agent 'a' should still appear in final votes
      expect(result.votes.some(v => v.agentId === 'a')).toBe(true);
    });

    it('should write debate round headers to the stream', async () => {
      await collab.debate(['a', 'b'], ctx, 3);
      const md = ctx.stream.markdown as ReturnType<typeof vi.fn>;
      const calls = md.mock.calls.map((c: any[]) => String(c[0]));
      expect(calls.some((c: string) => c.includes('Omgång'))).toBe(true);
    });

    it('should skip unknown agent IDs during debate', async () => {
      const result = await collab.debate(['a', 'unknown'], ctx);
      // Only 'a' produces votes
      expect(result.votes.every(v => v.agentId === 'a')).toBe(true);
    });
  });

  // ────────── consensus() ──────────

  describe('consensus()', () => {
    let collab: AgentCollaboration;
    let ctx: AgentContext;

    beforeEach(() => {
      const a = new StubAgent('a', 'AgentA', async (c) => {
        c.stream.markdown('First perspective');
        return {};
      });
      const b = new StubAgent('b', 'AgentB', async (c) => {
        c.stream.markdown('Second perspective');
        return {};
      });
      const registry = buildRegistry([a, b]);
      collab = new AgentCollaboration(registry);
      ctx = createMockContext();
    });

    it('should synthesize a consensus from multiple agents', async () => {
      const result = await collab.consensus(['a', 'b'], ctx);
      expect(result.question).toBe('Test question');
      expect(result.votes).toHaveLength(2);
      // Consensus text is produced by the LLM mock
      expect(result.consensus.length).toBeGreaterThan(0);
    });

    it('should call the model to synthesize answers', async () => {
      const sendSpy = ctx.request.model.sendRequest as ReturnType<typeof vi.fn>;
      await collab.consensus(['a', 'b'], ctx);
      expect(sendSpy).toHaveBeenCalled();
    });

    it('should set winner to null (consensus, not voting)', async () => {
      const result = await collab.consensus(['a', 'b'], ctx);
      expect(result.winner).toBeNull();
    });

    it('should compute an agreementLevel', async () => {
      const result = await collab.consensus(['a', 'b'], ctx);
      expect(result.agreementLevel).toBeGreaterThanOrEqual(0);
      expect(result.agreementLevel).toBeLessThanOrEqual(1);
    });

    // ── edge: fewer than 2 agents ──

    it('should short-circuit with a single agent', async () => {
      const result = await collab.consensus(['a'], ctx);
      expect(result.votes).toHaveLength(1);
      expect(result.consensus).toBe('First perspective');
      expect(result.agreementLevel).toBe(1);
      // The single vote becomes the winner
      expect(result.winner?.agentId).toBe('a');
    });

    it('should handle zero agents', async () => {
      const result = await collab.consensus([], ctx);
      expect(result.votes).toHaveLength(0);
      expect(result.winner).toBeNull();
      expect(result.consensus).toBe('');
      expect(result.agreementLevel).toBe(1);
    });

    it('should handle LLM synthesis failure gracefully', async () => {
      (ctx.request.model.sendRequest as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('model unavailable')
      );
      const result = await collab.consensus(['a', 'b'], ctx);
      expect(result.consensus).toContain('Kunde inte syntetisera');
    });
  });

  // ────────── reviewChain() ──────────

  describe('reviewChain()', () => {
    let collab: AgentCollaboration;
    let ctx: AgentContext;

    beforeEach(() => {
      const first = new StubAgent('first', 'FirstAgent', async (c) => {
        c.stream.markdown('Initial answer');
        return {};
      });
      const reviewer = new StubAgent('rev', 'ReviewAgent', async (c) => {
        c.stream.markdown('Improved answer');
        return {};
      });
      const registry = buildRegistry([first, reviewer]);
      collab = new AgentCollaboration(registry);
      ctx = createMockContext();
    });

    it('should run agents in sequence', async () => {
      const result = await collab.reviewChain(['first', 'rev'], ctx);
      expect(result.votes).toHaveLength(2);
      expect(result.votes[0].agentId).toBe('first');
      expect(result.votes[1].agentId).toBe('rev');
    });

    it('should pick the last agent as winner', async () => {
      const result = await collab.reviewChain(['first', 'rev'], ctx);
      expect(result.winner?.agentId).toBe('rev');
    });

    it('should use the last vote response as consensus', async () => {
      const result = await collab.reviewChain(['first', 'rev'], ctx);
      expect(result.consensus).toBe('Improved answer');
    });

    it('should handle a single agent in the chain', async () => {
      const result = await collab.reviewChain(['first'], ctx);
      expect(result.votes).toHaveLength(1);
      expect(result.winner?.agentId).toBe('first');
    });

    it('should skip missing agents gracefully', async () => {
      const result = await collab.reviewChain(['first', 'missing', 'rev'], ctx);
      expect(result.votes).toHaveLength(2);
    });

    it('should survive agent failure mid‑chain', async () => {
      const broken = new StubAgent('broken', 'BrokenAgent', async () => {
        throw new Error('chain break');
      });
      const registry = buildRegistry([
        new StubAgent('first', 'FirstAgent'),
        broken,
        new StubAgent('last', 'LastAgent'),
      ]);
      collab = new AgentCollaboration(registry);

      const result = await collab.reviewChain(['first', 'broken', 'last'], ctx);
      // 'broken' is skipped; 'first' and 'last' should still appear
      expect(result.votes.map(v => v.agentId)).toContain('first');
      expect(result.votes.map(v => v.agentId)).toContain('last');
    });

    it('should return empty result when chain has no agents', async () => {
      const result = await collab.reviewChain([], ctx);
      expect(result.votes).toHaveLength(0);
      expect(result.winner).toBeNull();
      expect(result.consensus).toBe('');
    });
  });

  // ────────── Error handling ──────────

  describe('error handling', () => {
    let collab: AgentCollaboration;
    let ctx: AgentContext;

    beforeEach(() => {
      const registry = buildRegistry([new StubAgent('ok', 'OkAgent')]);
      collab = new AgentCollaboration(registry);
      ctx = createMockContext();
    });

    it('should not throw when all requested agents are missing', async () => {
      const result = await collab.vote(['x', 'y', 'z'], ctx);
      expect(result.votes).toHaveLength(0);
      expect(result.winner).toBeNull();
    });

    it('should still judge remaining agents when some are missing', async () => {
      const result = await collab.vote(['ok', 'missing'], ctx);
      expect(result.votes).toHaveLength(1);
      expect(result.winner).not.toBeNull();
    });

    it('should handle LLM judge failure during vote', async () => {
      (ctx.request.model.sendRequest as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('LLM down')
      );
      // The judge catch block returns a fallback
      const result = await collab.vote(['ok'], ctx);
      expect(result.consensus).toBe('Kunde inte bedöma.');
      expect(result.winner?.agentId).toBe('ok');
    });

    it('should log error messages to stream when agents throw', async () => {
      const errAgent = new StubAgent('err', 'ErrAgent', async () => {
        throw new Error('agent error msg');
      });
      const registry = buildRegistry([errAgent]);
      collab = new AgentCollaboration(registry);

      await collab.vote(['err'], ctx);
      const md = ctx.stream.markdown as ReturnType<typeof vi.fn>;
      const calls = md.mock.calls.map((c: any[]) => String(c[0]));
      expect(calls.some((c: string) => c.includes('agent error msg'))).toBe(true);
    });
  });

  // ────────── Confidence & agreement heuristics ──────────

  describe('internal heuristics', () => {
    let collab: AgentCollaboration;

    beforeEach(() => {
      collab = new AgentCollaboration(buildRegistry());
    });

    it('should give higher confidence to long responses with code', async () => {
      const withCode = new StubAgent('c', 'Coder', async (c) => {
        c.stream.markdown('x'.repeat(600) + '\n```ts\nconst x = 1;\n```');
        return {};
      });
      const plain = new StubAgent('p', 'Plain', async (c) => {
        c.stream.markdown('short answer');
        return {};
      });
      const registry = buildRegistry([withCode, plain]);
      const col = new AgentCollaboration(registry);
      const ctx = createMockContext();

      const result = await col.vote(['c', 'p'], ctx);
      const coderVote = result.votes.find(v => v.agentId === 'c')!;
      const plainVote = result.votes.find(v => v.agentId === 'p')!;

      expect(coderVote.confidence).toBeGreaterThan(plainVote.confidence);
    });

    it('should lower confidence for uncertain language', async () => {
      const unsure = new StubAgent('u', 'Unsure', async (c) => {
        c.stream.markdown('x'.repeat(600) + ' kanske det fungerar, osäker');
        return {};
      });
      const sure = new StubAgent('s', 'Sure', async (c) => {
        c.stream.markdown('x'.repeat(600) + ' detta är lösningen');
        return {};
      });
      const registry = buildRegistry([unsure, sure]);
      const col = new AgentCollaboration(registry);
      const ctx = createMockContext();

      const result = await col.vote(['u', 's'], ctx);
      const unsureVote = result.votes.find(v => v.agentId === 'u')!;
      const sureVote = result.votes.find(v => v.agentId === 's')!;

      expect(unsureVote.confidence).toBeLessThan(sureVote.confidence);
    });
  });
});
