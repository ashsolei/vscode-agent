---
name: "Debug Pipeline"
description: "Debug the agent request pipeline — trace a request through routing, middleware, cache, guardrails, and agent execution"
argument-hint: "What's going wrong? e.g. 'Agent returns empty response' or 'Cache never hits'"
---

# Debug Pipeline Skill

Systematically debug issues in the VS Code Agent extension request pipeline.

## Request Flow

```
User message → handler() in extension.ts
  → check workflow/collab commands (e.g., /workflow, /vote, /debate)
  → resolve agent:
      - explicit slash command → AgentRegistry.getAgent(command)
      - no command → AgentRegistry.smartRoute(prompt)
  → check ResponseCache (LRU with TTL)
      - cache hit → return cached response, skip agent
  → if autonomous agent → GuardRails.createCheckpoint()
  → inject workspaceContext via ContextProviderRegistry
  → run MiddlewarePipeline.execute():
      - before hooks (timing, rate-limit, usage tracking)
      - agent.handle(ctx)
      - after hooks
      - onError hooks if handle() throws
  → capture streamed output for cache storage
  → log to telemetry/dashboard/conversation history
```

## Debug Checklist

### 1. Agent Not Found / Wrong Agent Selected
- Check slash command matches agent ID in `package.json`
- Check agent is registered in `src/extension.ts`
- For auto-routing: check agent `description` — `smartRoute()` uses descriptions
- Smart routing falls back to `code` agent if LLM fails
- Check `.agentrc.json` → `disabledAgents[]` — agent might be disabled

### 2. Empty Response
- Check cancellation: `token.isCancellationRequested` may be true
- Check model availability: `vscode.lm.selectChatModels()` might return `[]`
- Check model selection: `ModelSelector` might pick wrong model
- Check prompt construction: empty prompt → empty response
- Check middleware: a `before` hook might short-circuit execution

### 3. Cache Issues
- Cache key is `agentId + prompt` hash
- Check TTL (default: 5 minutes) — expired entries are evicted
- Check max size (default: 100) — LRU evicts oldest
- Cache stores actual streamed text via Proxy capture
- Settings: `vscodeAgent.cacheEnabled`, `vscodeAgent.cacheTTL`

### 4. Middleware Errors
- Hooks are error-isolated: each hook has its own try/catch
- A failing `before` hook does NOT prevent agent execution
- Check `onError` hooks — they receive the thrown error
- Built-in middleware: `TimingMiddleware`, `RateLimitMiddleware`, `UsageTrackingMiddleware`

### 5. Autonomous Agent Issues
- Check `isAutonomous` flag on agent constructor
- Check GuardRails: checkpoint may have rolled back changes
- Check AutonomousExecutor path validation: `validatePath()` rejects traversal
- Check dry-run mode in `.agentrc.json` → `guardrails.dryRun`

### 6. Context Provider Issues
- Providers fail silently (return empty string on error)
- Git diff requires a git repository
- Diagnostics require open files with language servers active
- Selection requires an active editor with selected text

## Diagnostic Commands

| Command | Purpose |
|---|---|
| `Agent: Health Check` | Verifies extension health, registered agents, middleware |
| `Agent: Show Dashboard` | Opens WebView with agent usage statistics |
| `Agent: Clear Cache` | Clears the ResponseCache |
| `Agent: Show Memory` | Shows AgentMemory contents |
| `Agent: Reload Config` | Reload `.agentrc.json` settings |

## Key Files to Inspect

| File | What to Debug |
|---|---|
| `src/extension.ts` | Handler function, registration order, initialization |
| `src/agents/index.ts` | `AgentRegistry` routing logic, `smartRoute()` |
| `src/middleware/middleware.ts` | `MiddlewarePipeline.execute()`, hook ordering |
| `src/cache/response-cache.ts` | Cache key generation, TTL, LRU eviction |
| `src/guardrails/guardrails.ts` | Checkpoint creation, rollback triggers |
| `src/context/context-providers.ts` | Provider execution, error suppression |
| `src/autonomous/executor.ts` | `validatePath()`, file CRUD, terminal commands |
| `src/models/model-selector.ts` | Model resolution per agent |

## Logging

Add temporary logging to trace the pipeline:
```typescript
// In extension.ts handler:
console.log(`[Agent] Command: ${request.command}, Prompt: ${request.prompt.substring(0, 50)}`);
console.log(`[Agent] Resolved to: ${agent?.id ?? 'none'}`);
console.log(`[Agent] Cache: ${cacheHit ? 'HIT' : 'MISS'}`);
```

View logs: **Output panel → Extension Host** in VS Code.
