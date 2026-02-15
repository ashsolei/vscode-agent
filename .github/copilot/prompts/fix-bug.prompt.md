---
mode: "agent"
description: "Diagnose and fix a bug — read errors, trace through the request pipeline, and apply the fix with tests"
---

# Fix a Bug

Systematically diagnose and fix a bug in the VS Code Agent extension.

## Diagnostic Steps

1. **Reproduce**: Understand the exact symptom (error message, wrong behavior, crash)
2. **Locate**: Search for the error message or relevant code path
3. **Trace the request flow**:
   - `extension.ts` handler → `AgentRegistry.resolve()` → cache check → guardrails → context injection → `MiddlewarePipeline.execute()` → `agent.handle()`
4. **Check common failure points**:
   - Middleware `before` returning `'skip'`
   - Rate limit exceeded
   - Cache serving stale data
   - `validatePath()` rejecting a legitimate path
   - Missing workspace folders
   - Cancellation token fired

## Fix Process

1. Write a failing test that reproduces the bug
2. Apply the minimal fix
3. Run `npm run compile` — no TypeScript errors
4. Run `npm test` — all tests pass including the new one
5. Check that error handling is graceful — no raw stack traces shown to users

## Common Pitfalls

- Don't fix symptoms — find the root cause
- Check if the bug exists in multiple agents (autonomous agents share patterns)
- Verify the fix doesn't break middleware error isolation
- Ensure cached responses are invalidated if the fix changes output format
