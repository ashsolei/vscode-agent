---
name: "Add Middleware"
description: "Create a new middleware hook for the MiddlewarePipeline — before/after/onError hooks for cross-cutting concerns"
argument-hint: "What cross-cutting concern? e.g. 'Log all agent responses to a file' or 'Block requests with profanity'"
---

# Add Middleware Skill

Create middleware for the VS Code Agent extension's `MiddlewarePipeline`.

## Architecture

Middleware in `src/middleware/middleware.ts` implements the `Middleware` interface:

```typescript
interface Middleware {
    name: string;
    before?(ctx: AgentContext): Promise<void>;
    after?(ctx: AgentContext, result: AgentResult): Promise<void>;
    onError?(ctx: AgentContext, error: Error): Promise<void>;
}
```

### Execution Order
```
before[0] → before[1] → ... → agent.handle() → after[0] → after[1] → ...
                                     ↓ (if throws)
                               onError[0] → onError[1] → ...
```

### Error Isolation
Each hook runs in its own try/catch. A failing middleware does NOT prevent other middleware or the agent from running.

## Built-in Middleware

| Middleware | Purpose |
|---|---|
| `TimingMiddleware` | Measures agent execution time, logs to console |
| `RateLimitMiddleware` | Enforces `vscodeAgent.rateLimitPerMinute` (default: 30) |
| `UsageTrackingMiddleware` | Tracks per-agent invocation counts |

## Template

```typescript
// src/middleware/<name>-middleware.ts
import { Middleware, AgentContext, AgentResult } from './middleware';

export class <Name>Middleware implements Middleware {
    readonly name = '<name>';

    async before(ctx: AgentContext): Promise<void> {
        // Called before agent.handle()
        // Use for: validation, logging, context enrichment, rate limiting
        // Can modify ctx (e.g., enrich workspaceContext)
        // Should NOT throw — will be caught but won't stop execution
    }

    async after(ctx: AgentContext, result: AgentResult): Promise<void> {
        // Called after successful agent.handle()
        // Use for: logging, metrics, result transformation
        // Can modify result.metadata
    }

    async onError(ctx: AgentContext, error: Error): Promise<void> {
        // Called when agent.handle() throws
        // Use for: error logging, alerting, cleanup
        // Error has already been caught — this is for observation only
    }
}
```

## Registration

In `src/extension.ts`, add to the middleware pipeline:
```typescript
import { <Name>Middleware } from './middleware/<name>-middleware';

// In activate():
pipeline.use(new <Name>Middleware());
```

## Testing

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { <Name>Middleware } from './<name>-middleware';

vi.mock('vscode');

describe('<Name>Middleware', () => {
    let middleware: <Name>Middleware;
    let mockCtx: any;

    beforeEach(() => {
        middleware = new <Name>Middleware();
        mockCtx = {
            request: { prompt: 'test', command: 'code' },
            chatContext: { history: [] },
            stream: { markdown: vi.fn(), progress: vi.fn() },
            token: { isCancellationRequested: false },
        };
    });

    it('should have a name', () => {
        expect(middleware.name).toBe('<name>');
    });

    it('before hook should not throw', async () => {
        await expect(middleware.before(mockCtx)).resolves.not.toThrow();
    });

    it('after hook should not throw', async () => {
        await expect(middleware.after(mockCtx, {})).resolves.not.toThrow();
    });

    it('onError hook should not throw', async () => {
        const error = new Error('test error');
        await expect(middleware.onError(mockCtx, error)).resolves.not.toThrow();
    });
});
```

## Rules

- Middleware hooks MUST NOT throw — wrap all logic in try/catch
- Keep hooks lightweight — they run on every request
- Use `before` for validation/enrichment, `after` for observation/metrics
- `onError` is for observation only — it cannot recover from errors
- Registration order matters — hooks execute in registration order
