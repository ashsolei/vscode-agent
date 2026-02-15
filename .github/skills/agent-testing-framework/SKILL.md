---
name: "Agent Testing Framework"
description: "Test the agent system: scenario-based testing, regression tests, prompt drift detection, golden-output comparison using Vitest + VS Code mock"
argument-hint: "Agent or system to test"
---

# Agent Testing Framework

Test the VS Code Agent extension's agent system end-to-end: scenario-based tests, regression suites, prompt drift detection, and golden-output comparison — all using Vitest with the VS Code mock at `src/__mocks__/vscode.ts`.

## Workflow

1. **Identify** the target — a specific agent, middleware, registry behavior, or cross-agent workflow.
2. **Write** scenario-based tests using the templates below.
3. **Create** golden outputs for regression comparison where applicable.
4. **Run** — `npm test` (unit), `npm run test:watch` (dev), `npm run test:coverage` (coverage).
5. **Review** coverage and update thresholds if needed.

## Test Categories

| Category | Purpose | Location |
|----------|---------|----------|
| Agent unit tests | Test `handle()` returns expected metadata | `src/agents/<name>.test.ts` |
| Registry tests | smartRoute, register, unregister, chaining | `src/agents/registry.test.ts` |
| Extended registry tests | Parallel execution, workflow routing | `src/agents/registry-extended.test.ts` |
| Middleware tests | Pipeline ordering, hooks, error isolation | `src/middleware/middleware.test.ts` |
| Middleware builtins | TimingMiddleware, RateLimiter, UsageTracking | `src/middleware/middleware-builtins.test.ts` |
| Cache tests | LRU eviction, TTL expiration, invalidation | `src/cache/cache.test.ts` |
| GuardRails tests | Checkpoint, rollback, dry-run | `src/guardrails/guardrails.test.ts` |
| Memory tests | Remember, recall, search, prune | `src/memory/memory.test.ts` |
| Profile tests | Agent profiles loading and switching | `src/profiles/profiles.test.ts` |

## Templates

### Scenario-based agent test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { CodeAgent } from './code-agent';

describe('CodeAgent scenarios', () => {
    it('should have correct id and non-autonomous flag', () => {
        const agent = new CodeAgent();
        expect(agent.id).toBe('code');
        expect(agent.isAutonomous).toBe(false);
    });

    it('should include agent id in metadata', async () => {
        const agent = new CodeAgent();
        const ctx = createMockContext('Explain this function');
        const result = await agent.handle(ctx);
        expect(result.metadata?.agent).toBe('code');
    });
});
```

### Mock context helper

```typescript
function createMockContext(prompt: string): AgentContext {
    return {
        request: { prompt, command: '', references: [] } as any,
        chatContext: { history: [] } as any,
        stream: {
            markdown: vi.fn(),
            progress: vi.fn(),
            reference: vi.fn(),
            button: vi.fn(),
            anchor: vi.fn()
        } as any,
        token: { isCancellationRequested: false, onCancellationRequested: vi.fn() } as any,
        workspaceContext: ''
    };
}
```

## Rules

- All tests use Vitest — imports: `describe`, `it`, `expect`, `vi`, `beforeEach`.
- VS Code mock at `src/__mocks__/vscode.ts` — no real VS Code instance in unit tests.
- Test files are **co-located** with source: `src/agents/registry.test.ts` tests `src/agents/index.ts`.
- Vitest configuration is in `vitest.config.ts` at the project root.
- Coverage uses v8 provider: `npm run test:coverage`.
- E2E tests run in a real VS Code instance via `@vscode/test-electron`: `npm run test:e2e`.
- Golden outputs stored in `__fixtures__/` directories alongside tests.
- Prompt drift hashes must be updated explicitly when prompts change intentionally.
- Tests must not depend on network access or external APIs.
- Zero runtime dependencies — test utilities must use only Node.js built-ins and Vitest.

## Checklist

- [ ] Scenario-based tests cover the target agent's `handle()` method
- [ ] Registry routing tests validate slash-command resolution and fallback
- [ ] Middleware tests confirm pipeline ordering and error isolation
- [ ] Golden-output and prompt drift tests created for critical prompts
- [ ] Mock context helper produces a valid `AgentContext`
- [ ] `npm test` passes with all new tests green
- [ ] `npm run test:coverage` meets coverage thresholds
- [ ] No flaky tests — deterministic, no timing or network dependencies
