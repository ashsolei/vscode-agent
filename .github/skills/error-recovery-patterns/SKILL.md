---
name: "Error Recovery Patterns"
description: "Systematic error recovery: classification (transient/permanent), retry with backoff, circuit breaker, fallback chains, GuardRails rollback"
argument-hint: "Error type or pattern"
---

# Error Recovery Patterns

Implement systematic error recovery for the VS Code Agent extension. Covers error classification, retry logic, circuit breakers, fallback chains, and GuardRails rollback — all within the zero-dependency constraint.

## Workflow

1. **Classify** the error — transient (network, rate limit, model unavailable) or permanent (invalid input, missing file, type error).
2. **Select** the recovery pattern from the table below.
3. **Implement** in the appropriate module (middleware, agent, or executor).
4. **Test** with Vitest — simulate failures using `vi.fn()` and `vi.spyOn()`.
5. **Validate** — `npm run compile && npm test`.

## Error Classification

| Category | Examples | Recovery |
|----------|----------|----------|
| Transient | Model rate limit, timeout, network blip | Retry with exponential backoff |
| Resource | Model unavailable, no workspace open | Fallback chain or user notification |
| Input | Invalid prompt, bad file path | Validation + clear error message |
| System | Extension crash, corrupted state | GuardRails rollback, cache clear |
| Autonomous | File write failed, path traversal blocked | Rollback checkpoint, abort operation |

## Templates

### Retry with exponential backoff

```typescript
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 500
): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt === maxRetries || !isTransient(err)) throw err;
            const delay = baseDelayMs * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error('Unreachable');
}

function isTransient(err: unknown): boolean {
    if (err instanceof Error) {
        return /rate.limit|timeout|ECONNRESET|429/i.test(err.message);
    }
    return false;
}
```

### GuardRails rollback on failure

```typescript
const checkpoint = guardrails.createCheckpoint(agentId);
try {
    await autonomousExecutor.execute(operation);
} catch (err) {
    await guardrails.rollback(checkpoint.id);
    stream.markdown('Åtgärden misslyckades. Ändringar har återställts.');
}
```

## Rules

- Middleware `onError` hooks are error-isolated — each is wrapped in try/catch in `MiddlewarePipeline`.
- Retry logic must respect `CancellationToken` — check `token.isCancellationRequested` between attempts.
- `AutonomousExecutor` validates paths via `validatePath()` — path traversal throws permanently.
- Smart routing falls back to the `code` agent if LLM routing fails (`src/agents/index.ts`).
- Rate limiting is configurable: `vscodeAgent.rateLimitPerMinute` (default: 30).
- Error messages shown to users must be in **Swedish**.
- Never swallow errors silently — log to the output channel or telemetry.
- Circuit breaker state is in-memory only — resets on extension reload.

## Checklist

- [ ] Errors classified as transient or permanent
- [ ] Retry with backoff implemented for transient errors
- [ ] Cancellation token checked between retry attempts
- [ ] Fallback chain routes to `code` agent on routing failure
- [ ] GuardRails checkpoint created before autonomous operations
- [ ] Rollback executed on autonomous operation failure
- [ ] Error messages displayed in Swedish to the user
- [ ] `npm run compile && npm test` passes with error recovery tests
