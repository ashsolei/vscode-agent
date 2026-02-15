---
name: "Observability Basics"
description: "Add observability: TelemetryReporter, TimingMiddleware metrics, UsageTrackingMiddleware, AgentDashboard WebView, structured logging"
argument-hint: "Observability area to add"
---

# Observability Basics

Add observability to the VS Code Agent extension. Covers telemetry reporting, middleware-level metrics, the AgentDashboard WebView, and structured logging — all using only the VS Code API (zero runtime dependencies).

## Workflow

1. **Identify** the observability gap — is it timing, usage tracking, error visibility, or dashboarding?
2. **Instrument** using the appropriate module (see modules below).
3. **Verify** data flows through the MiddlewarePipeline into the dashboard or telemetry output.
4. **Test** the instrumentation with Vitest.
5. **Validate** — run `npm run compile && npm test` and inspect the AgentDashboard.

## Core Modules

| Module | Path | Purpose |
|--------|------|---------|
| TelemetryReporter | `src/telemetry/` | VS Code telemetry events via `vscode.env.telemetryLogger` |
| TimingMiddleware | `src/middleware/middleware.ts` | Records `before`/`after` hooks to measure request duration |
| UsageTrackingMiddleware | `src/middleware/middleware.ts` | Counts per-agent invocations, tracks token usage |
| AgentDashboard | `src/dashboard/agent-dashboard.ts` | WebView panel showing agent stats, timing, errors |
| MiddlewarePipeline | `src/middleware/middleware.ts` | Orchestrates before/after/onError hooks for all requests |

## Templates

### Adding a timing middleware

```typescript
import { Middleware } from './middleware';

export const timingMiddleware: Middleware = {
    name: 'timing',
    priority: 10,  // Low number = runs early
    before: async (ctx) => {
        ctx.metadata = ctx.metadata || {};
        ctx.metadata._startTime = Date.now();
    },
    after: async (ctx, result) => {
        const elapsed = Date.now() - (ctx.metadata?._startTime ?? 0);
        console.log(`[timing] Agent ${ctx.agentId} took ${elapsed}ms`);
    }
};
```

### Structured logging pattern

```typescript
function log(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown>) {
    const entry = { timestamp: new Date().toISOString(), level, event, ...data };
    const channel = vscode.window.createOutputChannel('Agent', { log: true });
    channel[level](JSON.stringify(entry));
}

// Usage
log('info', 'agent.request', { agentId: 'code', prompt: userPrompt.slice(0, 100) });
```

### Error tracking in middleware

```typescript
export const errorTrackingMiddleware: Middleware = {
    name: 'error-tracking',
    priority: 5,
    onError: async (ctx, error) => {
        log('error', 'agent.error', {
            agentId: ctx.agentId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
    }
};
```

## Rules

- **Zero runtime dependencies** — use only `vscode.*` APIs for telemetry and logging.
- Middleware hooks are error-isolated — each hook is wrapped in try/catch to prevent cascading failures.
- TimingMiddleware must have low `priority` number to run before other middleware.
- `AgentDashboard` is a WebView panel — data is passed via `postMessage`.
- Telemetry respects `vscode.env.isTelemetryEnabled` — never send data when disabled.
- Structured log output goes to a dedicated OutputChannel (`vscode.window.createOutputChannel`).
- All middleware is registered in `src/extension.ts` via `pipeline.use()`.
- Tests for middleware live in `src/middleware/middleware.test.ts` and `src/middleware/middleware-builtins.test.ts`.

## Checklist

- [ ] TimingMiddleware records request duration for every agent invocation
- [ ] UsageTrackingMiddleware counts requests per agent
- [ ] Error tracking middleware captures and logs all `onError` events
- [ ] AgentDashboard WebView displays updated stats
- [ ] Structured logs include timestamp, level, event name, and agent ID
- [ ] Telemetry respects the user's telemetry opt-out setting
- [ ] `npm run compile && npm test` passes after instrumentation
- [ ] Middleware registered in `src/extension.ts` with correct priority ordering
