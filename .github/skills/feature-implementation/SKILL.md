---
name: "Feature Implementation"
description: "End-to-end feature implementation: plan, implement in TypeScript, register in extension.ts, add to package.json, write Vitest tests, document"
argument-hint: "Feature description"
---

# Feature Implementation

Implement features end-to-end in the VS Code Agent extension. Covers planning, TypeScript implementation, registration wiring, slash command declaration, Vitest test writing, and documentation.

## Workflow

1. **Plan** — define the feature scope, identify affected modules, and determine if it requires a new agent.
2. **Implement** — write TypeScript in `src/` following strict mode, ES2022 target, Node16 resolution.
3. **Register** — wire into `src/extension.ts` (agents, middleware, commands).
4. **Declare** — add slash commands to `package.json` under `chatParticipants[0].commands`.
5. **Test** — write co-located Vitest tests (`<module>.test.ts` in the same directory).
6. **Validate** — run `npm run compile && npm run lint && npm test`.
7. **Document** — update `README.md` or relevant walkthrough files in `media/walkthrough/`.

## Templates

### New agent implementation (`src/agents/<name>-agent.ts`)

```typescript
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

export class ExampleAgent extends BaseAgent {
  constructor() {
    super('example', 'Example Agent', 'Beskrivning av agenten');
    // For autonomous agents: super('example', 'Example', 'Desc', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const userPrompt = ctx.request.prompt;
    const systemPrompt = `You are an example agent. ${ctx.workspaceContext ?? ''}`;
    await this.sendLlmRequest(systemPrompt, userPrompt, ctx);
    return {};
  }
}
```

### Registration in `src/extension.ts`

```typescript
import { ExampleAgent } from './agents/example-agent';
// In activate():
registry.register(new ExampleAgent());
```

### Slash command in `package.json`

```json
{
  "name": "example",
  "description": "Beskrivning av kommandot"
}
```

### Co-located Vitest test (`src/agents/example.test.ts`)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ExampleAgent } from './example-agent';

describe('ExampleAgent', () => {
  it('should have correct id', () => {
    const agent = new ExampleAgent();
    expect(agent.id).toBe('example');
  });

  it('should handle context', async () => {
    const agent = new ExampleAgent();
    const ctx = { /* mock AgentContext */ } as any;
    const result = await agent.handle(ctx);
    expect(result).toBeDefined();
  });
});
```

## Rules

- **No runtime dependencies** — use only `vscode.*` API and built-in Node.js modules.
- Agent files follow the naming convention: `src/agents/<name>-agent.ts`, class `<Name>Agent`.
- Autonomous agents must pass `{ isAutonomous: true }` to `super()` and use `AutonomousExecutor`.
- Tests must be co-located in the same directory as the source file.
- Swedish for UI strings / user-facing messages; English for code identifiers and JSDoc.
- `description` on agents must be meaningful — `AgentRegistry.smartRoute()` uses it for auto-routing.
- All middleware hooks are error-isolated (try/catch); never let a hook crash the pipeline.
- TypeScript strict mode is enforced; fix all type errors before committing.

## Checklist

- [ ] Feature planned and scope defined
- [ ] TypeScript implementation in `src/` with strict types
- [ ] Agent registered in `src/extension.ts` if applicable
- [ ] Slash command added to `package.json` `chatParticipants[0].commands`
- [ ] Co-located Vitest test written (`<name>.test.ts`)
- [ ] `npm run compile` passes with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm test` passes — all tests green
- [ ] No runtime dependencies added
- [ ] Documentation updated (README, walkthrough, or inline JSDoc)
