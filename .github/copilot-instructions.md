# Copilot Instructions — VS Code Agent

## Project Overview
- VS Code extension (TypeScript, VS Code ^1.93.0) exposing a Chat Participant (`@agent`) with **30+ specialized AI agents**.
- No runtime dependencies — only `devDependencies` (TypeScript, Vitest, ESLint, vsce, @vscode/test-electron).
- Main wiring in [src/extension.ts](../src/extension.ts): builds shared state, middleware, cache, memory, guardrails, context providers, model selector, and registers all agents/commands.

## Architecture

### Request Flow
```
User message → handler()
  → check workflow/collab commands
  → resolve agent via slash-command or smartRoute()
  → check ResponseCache
  → create GuardRails checkpoint if autonomous
  → inject workspaceContext from ContextProviderRegistry
  → run through MiddlewarePipeline.execute()
  → capture streamed output for caching
  → log to telemetry/dashboard/conversation
```

### Core Modules
| Module | Path | Purpose |
|---|---|---|
| `BaseAgent` | [src/agents/base-agent.ts](../src/agents/base-agent.ts) | Abstract base — all agents implement `handle(ctx)` |
| `AgentRegistry` | [src/agents/index.ts](../src/agents/index.ts) | Routing, chaining, parallel execution, smart auto-routing, unregistration |
| `AutonomousExecutor` | [src/autonomous/executor.ts](../src/autonomous/executor.ts) | File CRUD, terminal commands, path traversal validation |
| `GuardRails` | [src/guardrails/guardrails.ts](../src/guardrails/guardrails.ts) | Checkpoint snapshots, rollback, dry-run |
| `MiddlewarePipeline` | [src/middleware/middleware.ts](../src/middleware/middleware.ts) | Before/after/onError hooks (timing, usage, rate-limit) |
| `ContextProviderRegistry` | [src/context/context-providers.ts](../src/context/context-providers.ts) | Git diff, diagnostics, selection, dependencies injection |
| `WorkflowEngine` | [src/workflow/workflow-engine.ts](../src/workflow/workflow-engine.ts) | Multi-agent pipelines with conditions, retry, parallel groups |
| `ModelSelector` | [src/models/model-selector.ts](../src/models/model-selector.ts) | Per-agent model selection via `.agentrc.json` |
| `ResponseCache` | [src/cache/response-cache.ts](../src/cache/response-cache.ts) | LRU cache with TTL for agent responses |
| `AgentMemory` | [src/memory/agent-memory.ts](../src/memory/agent-memory.ts) | Persistent memory — remember/recall/search/prune |
| `ConfigManager` | [src/config/config-manager.ts](../src/config/config-manager.ts) | `.agentrc.json` loader with file watcher |
| `ToolRegistry` | [src/tools/index.ts](../src/tools/index.ts) | Tool registration and execution (FileTool + SearchTool) |
| `EventDrivenEngine` | [src/events/event-engine.ts](../src/events/event-engine.ts) | Trigger agents on VS Code events (onSave, onDiag, etc.) |
| `AgentCollaboration` | [src/collaboration/agent-collaboration.ts](../src/collaboration/agent-collaboration.ts) | Multi-agent voting, debate, consensus |

### Key Interfaces
```typescript
interface AgentContext {
  request: vscode.ChatRequest;
  chatContext: vscode.ChatContext;
  stream: vscode.ChatResponseStream;
  token: vscode.CancellationToken;
  workspaceContext?: string;
}

interface AgentResult {
  metadata?: Record<string, unknown>;
  followUps?: vscode.ChatFollowup[];
}
```

## Code Style & Conventions
- **TypeScript strict mode**, ES2022 target, Node16 module resolution.
- **ESLint** with `@typescript-eslint/recommended`, lenient on `no-explicit-any`.
- Agent files: `src/agents/<name>-agent.ts`, class name `<Name>Agent`.
- Tests alongside source: `<name>.test.ts` in the same directory.
- Swedish for UI strings and user-facing messages in agents.
- English for code identifiers, types, and JSDoc.
- Autonomous agents pass `{ isAutonomous: true }` to `super()`.
- Middleware hooks are error-isolated (try/catch per hook).
- Response cache stores actual streamed text via a Proxy stream capture.
- Path traversal prevention via `validatePath()` in executor and file tool.

## Important Constraints
- **No runtime dependencies** — the extension ships with zero `dependencies`.
- **VS Code API only** — all functionality uses `vscode.*` namespace.
- Never hardcode agent lists — use `agent.isAutonomous` flag for guardrails.
- All file operations must go through `AutonomousExecutor` with path validation.
- `vscodeAgent.rateLimitPerMinute` (default: 30) — configurable rate limiting.
- Smart routing falls back to `code` agent if LLM routing fails.
- Agent registration order matters: first registered = default, then `setDefault('code')`.

## Development Workflows
- Build: `npm run compile` (tsc -p ./)
- Watch: `npm run watch` (tsc -watch, default build task)
- Lint: `npm run lint` (eslint src --ext ts)
- Unit tests: `npm test` or `npm run test:watch` (Vitest)
- Coverage: `npm run test:coverage` (v8 coverage)
- E2E tests: `npm run test:e2e` (@vscode/test-electron)
- Package: `npm run package` (vsce package --no-dependencies)
- Docker: `docker build -t vscode-agent .` (multi-stage, outputs VSIX)
- Health check: `Cmd+Shift+P → Agent: Health Check`

## Integration Points
- Chat Participant commands declared in `package.json`, handled in `extension.ts`.
- Plugin agents loaded via `PluginLoader` from `.agent-plugins/*.json`; unregistration uses `registry.unregister()`.
- `.agentrc.json` schema: `defaultAgent`, `language`, `autoRouter`, `disabledAgents[]`, `workflows{}`, `eventRules[]`, `memory{}`, `guardrails{}`, `prompts{}`, `models{}`.

## When Adding or Changing Agents
1. Create `src/agents/<name>-agent.ts`, extend `BaseAgent`.
2. If autonomous, pass `{ isAutonomous: true }` to `super()` and use `AutonomousExecutor`.
3. Register in [src/extension.ts](../src/extension.ts).
4. Add slash command to `package.json` under `chatParticipants[0].commands`.
5. Write tests in `src/agents/<name>.test.ts` following `registry.test.ts` patterns.
6. Ensure `description` is meaningful for smart auto-routing.
