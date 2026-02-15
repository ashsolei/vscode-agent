---
mode: "agent"
description: "Create a new middleware hook — before/after/onError handler for the agent pipeline with proper error isolation"
---

# Create Middleware

Build a new middleware for the agent execution pipeline.

## Middleware Interface

```typescript
interface Middleware {
  name: string;
  priority?: number;  // Lower = runs first. Default: 100
  before?(info: MiddlewareInfo): Promise<void | 'skip'>;
  after?(info: MiddlewareInfo): Promise<void>;
  onError?(info: MiddlewareInfo): Promise<void>;
}

interface MiddlewareInfo {
  agent: BaseAgent;
  ctx: AgentContext;
  startTime: number;
  endTime?: number;
  result?: AgentResult;
  error?: Error;
  meta: Record<string, unknown>;
}
```

## Template

```typescript
export function createMyMiddleware(/* deps */): Middleware {
  return {
    name: 'my-middleware',
    priority: 50,

    async before(info) {
      // Runs before agent.handle()
      // Return 'skip' to abort the agent execution
      // Access info.agent.id, info.ctx, info.meta
    },

    async after(info) {
      // Runs after successful agent.handle()
      // info.result is available
      // info.endTime - info.startTime = duration
    },

    async onError(info) {
      // Runs if agent.handle() throws
      // info.error contains the exception
    },
  };
}
```

## Registration

In `src/extension.ts`:
```typescript
middleware.use(createMyMiddleware(/* deps */));
```

## Rules

- After and onError hooks are automatically error-isolated (try/catch per hook)
- Before hooks can return `'skip'` to skip the agent — the result will be `{ metadata: { skippedBy: 'middleware-name' } }`
- Use `info.meta` to pass data between before → after hooks
- Built-in middlewares: timing (priority 10), usage (priority 20), rate-limit (priority 1)
- Write tests in `src/middleware/middleware-builtins.test.ts`
