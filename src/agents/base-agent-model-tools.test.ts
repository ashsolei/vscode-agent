import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode');

import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ModelSelector } from '../models/model-selector';
import { ToolRegistry } from '../tools';

// Concrete test agent
class TestModelToolsAgent extends BaseAgent {
  constructor() {
    super('test-mt', 'Test ModelTools', 'Test agent for model selector and tools');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const response = await this.chat(ctx, 'system prompt');
    return { metadata: { response } };
  }

  // Expose protected methods for testing
  async testResolveModel(ctx: AgentContext) {
    return this.resolveModel(ctx);
  }

  testGetModelOptions() {
    return this.getModelOptions();
  }

  async testExecuteTool(
    toolId: string,
    params: Record<string, unknown>,
    token: vscode.CancellationToken
  ) {
    return this.executeTool(toolId, params, token);
  }

  getToolRegistry() {
    return this.toolRegistry;
  }

  getModelSelectorRef() {
    return this.modelSelector;
  }
}

function createMockCtx(): AgentContext {
  const mockModel = {
    id: 'test-model',
    name: 'Test Model',
    family: 'test',
    sendRequest: vi.fn().mockResolvedValue({
      text: (async function* () { yield 'hello'; })(),
    }),
  } as unknown as vscode.LanguageModelChat;

  return {
    request: {
      prompt: 'test prompt',
      command: 'test',
      model: mockModel,
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

describe('BaseAgent — ModelSelector injection', () => {
  let agent: TestModelToolsAgent;

  beforeEach(() => {
    agent = new TestModelToolsAgent();
  });

  it('returns undefined modelSelector before injection', () => {
    expect(agent.getModelSelectorRef()).toBeUndefined();
  });

  it('setModelSelector() injects selector', () => {
    const selector = new ModelSelector();
    agent.setModelSelector(selector);
    expect(agent.getModelSelectorRef()).toBe(selector);
  });

  it('resolveModel() returns request model when no selector', async () => {
    const ctx = createMockCtx();
    const model = await agent.testResolveModel(ctx);
    expect(model).toBe(ctx.request.model);
  });

  it('resolveModel() uses ModelSelector when injected', async () => {
    const ctx = createMockCtx();
    const customModel = { id: 'custom-model', name: 'Custom' } as unknown as vscode.LanguageModelChat;

    const selector = new ModelSelector();
    vi.spyOn(selector, 'selectModel').mockResolvedValue(customModel);

    agent.setModelSelector(selector);
    const model = await agent.testResolveModel(ctx);

    expect(selector.selectModel).toHaveBeenCalledWith('test-mt', ctx.request.model);
    expect(model).toBe(customModel);
  });

  it('getModelOptions() returns empty object without selector', () => {
    expect(agent.testGetModelOptions()).toEqual({});
  });

  it('getModelOptions() delegates to selector when injected', () => {
    const selector = new ModelSelector();
    vi.spyOn(selector, 'getModelOptions').mockReturnValue({ maxTokens: 4000 } as any);

    agent.setModelSelector(selector);
    const options = agent.testGetModelOptions();

    expect(selector.getModelOptions).toHaveBeenCalledWith('test-mt');
    expect(options).toEqual({ maxTokens: 4000 });
  });

  it('chat() uses resolved model from selector', async () => {
    const ctx = createMockCtx();
    const customModel = {
      id: 'selected-model',
      sendRequest: vi.fn().mockResolvedValue({
        text: (async function* () { yield 'selected response'; })(),
      }),
    } as unknown as vscode.LanguageModelChat;

    const selector = new ModelSelector();
    vi.spyOn(selector, 'selectModel').mockResolvedValue(customModel);
    vi.spyOn(selector, 'getModelOptions').mockReturnValue({});

    agent.setModelSelector(selector);
    await agent.handle(ctx);

    // The custom model should have been used, not the request model
    expect(customModel.sendRequest).toHaveBeenCalled();
    expect(ctx.request.model.sendRequest).not.toHaveBeenCalled();
  });
});

describe('BaseAgent — ToolRegistry injection', () => {
  let agent: TestModelToolsAgent;

  beforeEach(() => {
    agent = new TestModelToolsAgent();
  });

  it('returns undefined toolRegistry before injection', () => {
    expect(agent.getToolRegistry()).toBeUndefined();
  });

  it('setTools() injects registry', () => {
    const tools = ToolRegistry.createDefault();
    agent.setTools(tools);
    expect(agent.getToolRegistry()).toBe(tools);
  });

  it('executeTool() returns error when no registry', async () => {
    const token = { isCancellationRequested: false } as vscode.CancellationToken;
    const result = await agent.testExecuteTool('file', {}, token);
    expect(result.success).toBe(false);
    expect(result.error).toContain('ToolRegistry ej injicerat');
  });

  it('executeTool() delegates to registry when injected', async () => {
    const tools = ToolRegistry.createDefault();
    const mockResult = { success: true, data: 'file content' };
    vi.spyOn(tools, 'execute').mockResolvedValue(mockResult);

    agent.setTools(tools);
    const token = { isCancellationRequested: false } as vscode.CancellationToken;
    const result = await agent.testExecuteTool('file', { path: '/test.ts' }, token);

    expect(tools.execute).toHaveBeenCalledWith('file', { path: '/test.ts' }, token);
    expect(result).toBe(mockResult);
  });
});
