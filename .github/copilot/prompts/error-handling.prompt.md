---
mode: "agent"
description: "Add proper error handling — wrap async operations, add user-facing messages, and ensure error isolation across the pipeline"
---

# Add Error Handling

Improve error handling in the specified code.

## Error Handling Patterns in This Project

### Agent Handle Method
```typescript
async handle(ctx: AgentContext): Promise<AgentResult> {
  try {
    // ... agent logic ...
  } catch (error) {
    if (ctx.token.isCancellationRequested) {
      ctx.stream.markdown('\n\n*— Avbruten av användaren.*');
      return {};
    }
    const message = error instanceof Error ? error.message : String(error);
    ctx.stream.markdown(`\n\n⚠️ Fel: ${message}`);
    return {};
  }
}
```

### BaseAgent.chat() (already has error handling)
- Checks `ctx.token.isCancellationRequested` in the streaming loop
- Wraps model errors with user-facing message: `⚠️ Model error: ...`

### Middleware Hooks (error-isolated)
```typescript
// After/onError hooks are individually wrapped:
try {
  await mw.after(info);
} catch (afterErr) {
  console.error(`Middleware "${mw.name}" after-hook error:`, afterErr);
}
```

### Autonomous Operations
```typescript
try {
  const uri = this.validatePath(relativePath, ws);
  // ... operation ...
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Okänt fel';
  return this.record('action', false, `Failed: ${msg}`);
}
```

## Rules

- Always use `error instanceof Error ? error.message : String(error)` for messages
- Never expose raw stack traces to users in the chat stream
- Log detailed errors to the output channel, show friendly messages in chat
- Check `ctx.token.isCancellationRequested` before and during long operations
- Don't swallow errors silently — at minimum log them
- Autonomous executor methods should return `ActionResult` with `success: false`, not throw
