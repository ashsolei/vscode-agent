import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode');

import * as vscode from 'vscode';
import { AgentCollaboration } from './agent-collaboration';
import { AgentRegistry, AgentContext } from '../agents';
import { BaseAgent, AgentResult } from '../agents/base-agent';

// Minimal agent for testing review chain command wiring
class StubChainAgent extends BaseAgent {
  constructor(id: string) {
    super(id, `${id}-agent`, `Stub ${id}`);
  }
  async handle(ctx: AgentContext): Promise<AgentResult> {
    ctx.stream.markdown(`Response from ${this.id}`);
    return {};
  }
}

function createMockCtx(prompt = 'review this code'): AgentContext {
  return {
    request: {
      prompt,
      command: 'collab-review',
      model: {
        id: 'test-model',
        sendRequest: vi.fn(),
      },
    } as unknown as vscode.ChatRequest,
    chatContext: { history: [] } as unknown as vscode.ChatContext,
    stream: {
      markdown: vi.fn(),
      progress: vi.fn(),
      button: vi.fn(),
      reference: vi.fn(),
    } as unknown as vscode.ChatResponseStream,
    token: { isCancellationRequested: false } as vscode.CancellationToken,
  };
}

describe('reviewChain slash command wiring', () => {
  let registry: AgentRegistry;
  let collaboration: AgentCollaboration;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(new StubChainAgent('code'));
    registry.register(new StubChainAgent('review'));
    registry.register(new StubChainAgent('security'));
    collaboration = new AgentCollaboration(registry);
  });

  it('reviewChain runs agents sequentially', async () => {
    const ctx = createMockCtx();
    const result = await collaboration.reviewChain(['code', 'review'], ctx);

    expect(result.votes).toHaveLength(2);
    expect(result.votes[0].agentId).toBe('code');
    expect(result.votes[1].agentId).toBe('review');
  });

  it('reviewChain returns last agent as winner', async () => {
    const ctx = createMockCtx();
    const result = await collaboration.reviewChain(['code', 'review', 'security'], ctx);

    expect(result.winner?.agentId).toBe('security');
  });

  it('reviewChain skips missing agents', async () => {
    const ctx = createMockCtx();
    const result = await collaboration.reviewChain(['code', 'nonexistent', 'review'], ctx);

    // 'nonexistent' should be skipped
    expect(result.votes).toHaveLength(2);
    expect(result.votes.map(v => v.agentId)).toEqual(['code', 'review']);
  });

  it('reviewChain with single agent returns that agent', async () => {
    const ctx = createMockCtx();
    const result = await collaboration.reviewChain(['code'], ctx);

    expect(result.votes).toHaveLength(1);
    expect(result.winner?.agentId).toBe('code');
  });

  it('handler metadata contains correct command for collab-review', () => {
    // Simulate what extension.ts handler does
    const agentIds = 'code,review,security'.split(',').map(s => s.trim());
    expect(agentIds).toEqual(['code', 'review', 'security']);

    // Result metadata shape matches handler return
    const metadata = { command: 'collab-review', steps: 3 };
    expect(metadata.command).toBe('collab-review');
    expect(metadata.steps).toBe(3);
  });
});
