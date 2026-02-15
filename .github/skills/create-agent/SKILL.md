---
name: "Create Agent"
description: "Create a new specialized AI agent that extends BaseAgent, register it in extension.ts, add the slash command to package.json, and write Vitest tests"
argument-hint: "What should the agent do? e.g. 'Monitor file changes and suggest improvements'"
---

# Create Agent Skill

You are creating a new agent for the VS Code Agent extension. This extension has 30+ agents that each extend `BaseAgent` and are registered in `src/extension.ts`.

## Step-by-Step Process

### 1. Create the Agent File

Create `src/agents/<name>-agent.ts`:

```typescript
import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

export class <Name>Agent extends BaseAgent {
    constructor() {
        super(
            '<name>',                           // unique ID
            'Kort beskrivning på svenska',      // description (Swedish)
            { isAutonomous: false }             // set true if agent modifies files/runs commands
        );
    }

    async handle(ctx: AgentContext): Promise<AgentResult> {
        const { request, stream, token } = ctx;
        const userPrompt = request.prompt;

        // Check cancellation
        if (token.isCancellationRequested) {
            return {};
        }

        // Build the prompt
        const messages = [
            vscode.LanguageModelChatMessage.User(
                `You are a specialized agent for <purpose>.\n\n` +
                `${ctx.workspaceContext ? `Workspace context:\n${ctx.workspaceContext}\n\n` : ''}` +
                `User request: ${userPrompt}`
            )
        ];

        // Get language model
        const [model] = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o'
        });

        if (!model) {
            stream.markdown('Ingen språkmodell tillgänglig.');
            return {};
        }

        // Stream response
        const chatResponse = await model.sendRequest(messages, {}, token);
        for await (const fragment of chatResponse.text) {
            if (token.isCancellationRequested) break;
            stream.markdown(fragment);
        }

        return {
            metadata: { agent: '<name>' },
            followUps: [
                { prompt: 'Follow-up suggestion', label: 'Label' }
            ]
        };
    }
}
```

### 2. Register in extension.ts

In `src/extension.ts`, add:
```typescript
import { <Name>Agent } from './agents/<name>-agent';

// In activate(), add to agent registration:
registry.register(new <Name>Agent());
```

### 3. Add Slash Command to package.json

In `package.json` under `contributes.chatParticipants[0].commands`:
```json
{
    "name": "<name>",
    "description": "Beskrivning på svenska"
}
```

### 4. Write Tests

Create `src/agents/<name>.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { <Name>Agent } from './<name>-agent';

// Mock vscode module
vi.mock('vscode');

describe('<Name>Agent', () => {
    let agent: <Name>Agent;

    beforeEach(() => {
        agent = new <Name>Agent();
    });

    it('should have correct id', () => {
        expect(agent.id).toBe('<name>');
    });

    it('should have a description', () => {
        expect(agent.description).toBeTruthy();
    });

    it('should handle requests', async () => {
        const mockStream = {
            markdown: vi.fn(),
            progress: vi.fn(),
            reference: vi.fn(),
            button: vi.fn(),
            anchor: vi.fn(),
        };
        const mockToken = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
        const ctx = {
            request: { prompt: 'test prompt', command: '<name>' },
            chatContext: { history: [] },
            stream: mockStream,
            token: mockToken,
        };

        const result = await agent.handle(ctx as any);
        expect(result).toBeDefined();
    });
});
```

## Decision Points

### Autonomous vs Non-Autonomous
- **Non-autonomous** (default): Read-only agents that analyze, explain, or generate suggestions
- **Autonomous** (`{ isAutonomous: true }`): Agents that create/modify files or run terminal commands
  - Must use `AutonomousExecutor` from `src/autonomous/executor.ts`
  - Subject to `GuardRails` checkpoint/rollback
  - Path validation required via `validatePath()`

### Model Selection
- Default: `gpt-4o` via `vscode.lm.selectChatModels`
- Per-agent override: configure in `.agentrc.json` under `models.<agentId>`
- Use `ModelSelector` from `src/models/model-selector.ts` for custom selection

## Checklist
- [ ] Agent file created in `src/agents/`
- [ ] Extends `BaseAgent` with unique ID
- [ ] `handle(ctx)` implemented with cancellation checks
- [ ] Registered in `src/extension.ts`
- [ ] Slash command added to `package.json`
- [ ] Tests written in `src/agents/<name>.test.ts`
- [ ] Description in Swedish for UI
- [ ] If autonomous: uses AutonomousExecutor + path validation
