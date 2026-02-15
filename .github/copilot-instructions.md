# Copilot Instructions — VS Code Agent

> **Last updated:** 2026-02-15 | **Version:** 2.0.0

## Project Intelligence (Auto-Generated)

- **Tech stack:** TypeScript 5.x, VS Code Extension API ^1.93.0, Vitest, ESLint
- **Architecture:** Modular multi-agent system with layered orchestration (registry → middleware → cache → guardrails → context → model selection)
- **Key modules/services:** 30+ specialized agents, AutonomousExecutor, WorkflowEngine, AgentCollaboration, EventDrivenEngine, PluginLoader, ModelSelector, ResponseCache, AgentMemory, GuardRails, ContextProviderRegistry
- **Build/test commands:** `npm run compile`, `npm test`, `npm run lint`, `npm run test:coverage`, `npm run test:e2e`
- **CI/CD:** GitHub Actions (build → lint → test → package → Docker)
- **Docker:** Multi-stage build (node:20-alpine → compile → vsce package → artifact container)
- **Security tooling:** Path traversal validation (`validatePath()`), rate limiting, guardrails checkpoints, dry-run mode
- **Observability:** OutputChannel logging, AgentDashboard, TelemetryEngine, timing/usage middleware, AgentStatusBar
- **Deployment:** VSIX package via `vsce package --no-dependencies` or Docker artifact extraction

## Project Overview

- VS Code extension (TypeScript, VS Code ^1.93.0) exposing a Chat Participant (`@agent`) with **30+ specialized AI agents**.
- No runtime dependencies — only `devDependencies` (TypeScript, Vitest, ESLint, vsce, @vscode/test-electron).
- Main wiring in [src/extension.ts](../src/extension.ts): builds shared state, middleware, cache, memory, guardrails, context providers, model selector, and registers all agents/commands.
- Agent system is designed for **maximum autonomy**, with capability abstraction, multi-model routing, and self-evolution.

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

### Orchestration Layers
| Layer | Purpose | Components |
|---|---|---|
| **L0 — Orchestrator** | Planning, coordination, quality gates | `orchestrator.md`, `WorkflowEngine` |
| **L1 — Domain Agents** | Specialized parallel work | 30+ agents (code, docs, security, test, etc.) |
| **L2 — Micro Agents** | Per-module/component tasks | Dynamic via `CreateAgentAgent` |
| **L3 — Verification** | Independent validation | `tester.md`, `verification.md`, `agent-tester.md` |
| **L4 — AI Evolution** | Capability discovery & adoption | `ai-evolution.md`, `capability-scanner.md`, `model-router.md` |
| **L5 — Strategic Planning** | Plan generation & optimization | `planner.md`, `roadmap.md`, `prioritizer.md` |
| **L6 — Agent Communication** | Coordination & conflict resolution | `conflict-resolver.md`, handoff protocol |
| **L7 — Metrics & Feedback** | Continuous learning | `metrics.md`, `self-improve.md` |

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
- Capability abstraction — agents reference capabilities, not specific model versions.
- All agent instructions are model-agnostic where possible.

## Important Constraints
- **No runtime dependencies** — the extension ships with zero `dependencies`.
- **VS Code API only** — all functionality uses `vscode.*` namespace.
- Never hardcode agent lists — use `agent.isAutonomous` flag for guardrails.
- All file operations must go through `AutonomousExecutor` with path validation.
- `vscodeAgent.rateLimitPerMinute` (default: 30) — configurable rate limiting.
- Smart routing falls back to `code` agent if LLM routing fails.
- Agent registration order matters: first registered = default, then `setDefault('code')`.
- **Multi-provider resilience** — never depend on a single AI provider; every capability must have at least one fallback.
- **No placeholders** — every output must be real, complete, and executable.

## Quality Gates
All changes must pass these gates before merge:
- [ ] **Build** — `npm run compile` exits 0
- [ ] **Lint** — `npm run lint` exits 0
- [ ] **Tests** — `npm test` all pass
- [ ] **Security Scan** — no known vulnerabilities in dependencies
- [ ] **Dependency Audit** — `npm audit` clean
- [ ] **Docker Build** — `docker build -t vscode-agent .` succeeds
- [ ] **No secrets in code** — no API keys, tokens, or credentials committed
- [ ] **Documentation updated** — README, CHANGELOG, and inline docs current

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
- Copilot custom agents in `.github/copilot/agents/*.md` with YAML frontmatter.
- Prompt files in `.github/copilot/prompts/*.prompt.md` with YAML frontmatter.
- Agent Skills in `.github/skills/<name>/SKILL.md` with YAML frontmatter.
- Capability Registry in `.github/copilot/CAPABILITY-REGISTRY.md` — living document mapping AI capabilities to agent behaviors.
- Evolution Protocol in `.github/copilot/EVOLUTION-PROTOCOL.md` — self-evolution workflow.
- Autonomy Guardrails in `.github/copilot/AUTONOMY-GUARDRAILS.md` — hard policy for all agents.

## When Adding or Changing Agents
1. Create `src/agents/<name>-agent.ts`, extend `BaseAgent`.
2. If autonomous, pass `{ isAutonomous: true }` to `super()` and use `AutonomousExecutor`.
3. Register in [src/extension.ts](../src/extension.ts).
4. Add slash command to `package.json` under `chatParticipants[0].commands`.
5. Write tests in `src/agents/<name>.test.ts` following `registry.test.ts` patterns.
6. Ensure `description` is meaningful for smart auto-routing.
7. Create corresponding Copilot agent in `.github/copilot/agents/<name>.md` with frontmatter, capability declarations, I/O contract, adaptation hooks, and model preferences.
8. Update `.github/copilot/CAPABILITY-REGISTRY.md` if new capabilities are introduced.

## AI Evolution & Future-Proofing
- The agent system is designed to self-evolve when new AI capabilities arrive — see `EVOLUTION-PROTOCOL.md`.
- All agents declare capabilities via abstraction interfaces, not model-specific references.
- The `CAPABILITY-REGISTRY.md` is the living document mapping available AI features to agent behaviors.
- Model routing is handled by `ModelSelector` in code and `model-router.md` in the Copilot agent layer.
- When any AI provider (Copilot, Claude, GPT, Gemini, local models, MCP) ships new features, Layer 4 agents (`ai-evolution.md`, `capability-scanner.md`) detect and adapt.
