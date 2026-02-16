# Changelog

All notable changes to the **VS Code Agent** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2025-07-12

### Fixed
- **Critical: GuardRails checkpoint always empty** — `createCheckpoint()` was called with `[]` for filePaths making rollback a no-op; now stores the checkpoint reference and populates it post-execution via `guardrails.markCreated()` using `result.metadata.filesAffected`
- **Cache key cross-agent poisoning** — `ResponseCache.makeKey()` was called without agent identifier; now passes `agent.id` as third parameter, scoping cached responses per-agent
- **`dryRun()` silent no-op** — `GuardRails` was constructed without a stream, so `dryRun()` always early-returned; method now accepts optional `targetStream` parameter that callers pass from the handler
- **Telemetry included dialog wait time** — `_startTime = Date.now()` was measured before the modal confirmation dialog; moved to after the dialog so telemetry only measures actual agent execution

### Added
- **`createCaptureStream()` utility** — new streaming utility in `src/utils/streaming.ts` returning `[proxyStream, getCapturedText]` tuple; replaces inline 15-line Proxy pattern in extension.ts
- **12 new tests** — `createCaptureStream` (4), `dryRun` with `targetStream` (3), `markCreated` (2), cache key with agent differentiation (2), dryRun no-op safety (1)

### Changed
- **Memory save gating** — agent responses are no longer unconditionally saved; memory now skips when `result.metadata.remember === false` or response text is shorter than 100 characters
- `GuardRails.dryRun()` signature expanded: `dryRun(operations, targetStream?)` — prefers `targetStream`, falls back to constructor stream
- Inline stream capture Proxy in `extension.ts` replaced with shared `createCaptureStream()` from utils

### Improved
- Total tests: 805 across 40 test files (up from 793/40)
- Cache isolation prevents cross-agent cache hits
- Checkpoint system now records affected files for meaningful rollback
- Telemetry accuracy improved — excludes user interaction wait time

## [0.8.0] - 2025-07-12

### Fixed
- **Critical: `eventEngine` forward reference** — `configManager.onDidChange` callback referenced `eventEngine` before its `const` declaration; hoisted to `let` with runtime guard `if (config.eventRules && eventEngine)` to eliminate temporal dead zone risk
- **`guardrails.dryRunDefault` no-op** — config handler only logged the dry-run setting without applying it; now correctly assigns `guardrailsDryRun = config.guardrails.dryRunDefault`
- **Profile middleware wiring was log-only** — profile activation/deactivation now actually rebuilds the `MiddlewarePipeline`: clears existing middlewares, re-adds rate limiter, and adds profile-specified middlewares (timing/usage/logging); deactivation restores default pipeline

### Added
- **`TerminalTool`** — new tool (`id: 'terminal'`) enabling agents to run shell commands via `vscode.window.createTerminal()`; accepts `command` (required) and `cwd` (optional) parameters
- **`DiagnosticsTool`** — new tool (`id: 'diagnostics'`) for querying workspace diagnostics via `vscode.languages.getDiagnostics()`; supports `list` (with severity/file filtering, capped at 50), `count` (errors/warnings/info/hints), and `summary` (top 20 files by error count) actions
- **`createFiles()` atomic rollback** — on partial failure, already-created files are deleted (best-effort), remaining files are marked as skipped ("Överhoppad (rollback)"); rollback skipped when DiffPreview is active
- **`ExternalIntegrations.reload()`** — new method for live config updates from `.agentrc.json`; layers explicit config values on top of environment variable defaults; wired into `configManager.onDidChange` callback
- **`window.createTerminal` mock** — VS Code mock expanded to support terminal creation in unit tests
- **18 new unit tests** — TerminalTool (4), DiagnosticsTool (6), createFiles rollback (3), ExternalIntegrations reload (5)

### Changed
- `ToolRegistry.createDefault()` registers 4 tools (was 2): FileTool, SearchTool, TerminalTool, DiagnosticsTool
- `eventEngine` declaration changed from `const` to `let` with forward declaration before config callback

### Improved
- Total tests: 793 across 40 test files (up from 775/40)
- Agent tool ecosystem expanded — agents can now run commands and query diagnostics
- Config changes to external integrations take effect immediately via `configManager.onDidChange`
- File creation operations are safer with automatic rollback on partial failure

## [0.7.0] - 2025-07-12

### Added
- **Plugin DiffPreview injection** — dynamically loaded plugin agents now receive `DiffPreview` via `setDiffPreview()` in the plugin loader callback, fixing a bug where plugin agents bypassed interactive diff review
- **Profile deep wiring** — `profileManager.onDidChange` subscription wires `guardLevel` → guardrails (strict = always enabled, relaxed = disabled, normal = settings default), `models` → `ModelSelector.updateConfig()`, `middleware` → output channel logging; deactivation resets all to VS Code settings defaults
- **Dynamic Plugins tree category** — `AgentTreeProvider.getChildren()` now detects agents not in any hardcoded category and groups them into a dynamic "Plugins" category with a plug icon; category only appears when uncategorized agents exist
- **maxSteps enforcement** — `AutonomousExecutor` gains step counting with configurable `maxSteps` (default 10 via `vscodeAgent.autonomous.maxSteps`); `createFile`, `editFile`, `deleteFile`, `runCommand` each consume a step; read-only operations are free; throws when limit exceeded
- **Live settings reload** — `vscode.workspace.onDidChangeConfiguration` listener handles all settings sections: `rateLimitPerMinute` rebuilds middleware pipeline, `guardrails.*` toggles guardrails/dry-run, `notifications/telemetry/cache/codeLens` update at runtime without restart
- **`MiddlewarePipeline.clear()`** — new method to remove all middlewares, enabling live pipeline rebuild on settings change
- **20 new unit tests** — maxSteps enforcement (8), dynamic Plugins category (5), middleware `clear()` (2), profile wiring with guardLevel/models/middleware/deactivation (5)

### Changed
- `AutonomousExecutor` constructor accepts optional `maxSteps` parameter (reads from config if omitted)
- 7 settings variables in `extension.ts` changed from `const` to `let` to support live settings reload and profile wiring
- `MiddlewarePipeline` exposes `clear()` for pipeline teardown and rebuild

### Improved
- Total tests: 775 across 40 test files (up from 757/40)
- Plugin agents have full feature parity with builtin agents (DiffPreview injection)
- Profile activation now has real side effects beyond agent filtering
- Settings changes take effect immediately without extension restart
- Autonomous agents have bounded execution preventing runaway operations

## [0.6.0] - 2025-07-11

### Added
- **DiffPreview → AutonomousExecutor wiring** — all 15 autonomous agents and plugin-loaded agents now route file changes through `DiffPreview` when available; `createFile()`, `editFile()`, and `deleteFile()` collect diffs for interactive preview instead of writing directly; handler shows diff review UI after autonomous execution and logs applied/rejected counts
- **Custom Workflows from `.agentrc.json`** — `WorkflowEngine` gains custom workflow CRUD (`registerWorkflow`, `getWorkflow`, `listWorkflows`, `removeWorkflow`, `clearWorkflows`); workflows defined in `.agentrc.json` `workflows` key are auto-registered at startup and on config changes; new `/workflow-run` slash command to list and execute named workflows
- **NotificationCenter deep integration** — `EventDrivenEngine` gains `onDidTrigger` event emitter; event-triggered agent runs now route through `NotificationCenter`; guardrails checkpoint creation generates info notifications; autonomous agent execution wrapped in `withProgress()` for real-time progress toasts
- **17 new unit tests** — DiffPreview↔Executor integration (11 tests), custom workflow CRUD (8 tests), EventDrivenEngine `onDidTrigger` (2 tests)

### Changed
- `AutonomousExecutor` constructor now accepts optional `DiffPreview` as second parameter
- `BaseAgent` gains 5th injection slot: `_diffPreview` with `setDiffPreview()` and protected accessor
- `EventDrivenEngine` properly disposes `_onDidTrigger` emitter
- Handler wraps autonomous agent execution in `notifications.withProgress()` when notifications are enabled

### Improved
- Total tests: 757 across 40 test files (up from 740/40)
- All autonomous agents now provide interactive file change review before applying
- Event-driven agent triggers visible to users via notification center
- Guardrails checkpoint events surfaced as user-visible notifications

## [0.5.0] - 2025-07-10

### Added
- **ModelSelector → BaseAgent wiring** — per-agent and per-category model routing now live; `BaseAgent` gains `resolveModel()` and `getModelOptions()` helpers; `chat()` and `chatRaw()` automatically use the best model based on agent category (basic, analysis, architecture, autonomous, etc.) and `.agentrc.json` config
- **ToolRegistry injection** — all agents can now access tools via `this.toolRegistry` and execute them with `this.executeTool(name, args)`; injection loop in `extension.ts` wires `setTools()` on all agents including dynamically loaded plugins
- **ConfigManager full `.agentrc.json` wiring** — all 6 config keys are now consumed at runtime:
  - `defaultAgent` → updates `registry.setDefault()` on config change
  - `disabledAgents` → blocks agent routing with user-facing warning
  - `prompts` → per-agent custom prompt injection into workspace context
  - `eventRules` → dynamic `EventDrivenEngine` rule registration
  - `memory` → triggers `memory.prune()` with maxAge/maxCount
  - `guardrails` → logged for future guardrails integration
- **`/collab-review` slash command** — exposes `AgentCollaboration.reviewChain()` via chat UI; agents review each other's output sequentially, building on prior answers
- **Plugin loader full injection** — dynamically loaded plugin agents now receive all 4 dependencies: registry, memory, modelSelector, and toolRegistry
- **25 new unit tests** — ModelSelector/ToolRegistry injection (11 tests), ConfigManager wiring (9 tests), reviewChain collaboration (5 tests)

### Changed
- `BaseAgent` has new `_modelSelector` field with `setModelSelector()`, protected `modelSelector` accessor, `resolveModel()`, and `getModelOptions()` helper methods
- `BaseAgent` has new `_toolRegistry` field with `setTools()`, protected `toolRegistry` accessor, and `executeTool()` convenience method
- `chat()` and `chatRaw()` now use `resolveModel()` + `getModelOptions()` instead of `ctx.request.model` directly
- Handler applies startup config (defaultAgent, disabledAgents) and watches for live changes
- Handler checks `configManager.isDisabled()` before routing to an agent and injects custom prompts from config

### Improved
- Total tests: 740 across 40 test files (up from 715/37)
- All major subsystems (ModelSelector, ToolRegistry, ConfigManager, Collaboration) now fully wired end-to-end
- Config-driven agent management is now runtime-reactive (live reload via FileSystemWatcher)

## [0.4.0] - 2025-07-09

### Added
- **AgentMemory injection** — memory system now wired into all agents via `setMemory()` on `BaseAgent`; agents can access `this.memory` for remember/recall; handler automatically saves response summaries and injects memory context into prompts
- **Marketplace → PluginLoader wiring** — install/uninstall callbacks now functional; marketplace file writes trigger `PluginLoader` file watcher for auto-registration; uninstall calls `registry.unregister()` + tree refresh
- **Snippet auto-save fix** — "Save as snippet" button now passes agent response text; handler uses agent content instead of editor text when available
- **EventEngine default rules** — predefined rules (`autoFixOnSave`, `securityOnNewFile`, `docsOnErrors`) now registered at startup (disabled by default, config-gated via `vscodeAgent.events`)
- **17 new unit tests** — BaseAgent memory injection (6 tests), EventEngine default rules (5 tests), Marketplace callback wiring (6 tests)

### Changed
- `BaseAgent` has new `_memory` field with `setMemory()` and protected `memory` accessor
- Handler context injection now includes memory context alongside workspace and conversation context
- Handler saves agent responses to memory with `type: 'context'` for future retrieval
- Snippet command handler signature expanded to `(agentId?, prompt?, agentContent?)`

### Improved
- Total tests: 715 across 37 test files (up from 698/34)
- Four previously inert subsystems now fully functional

## [0.3.0] - 2025-07-09

### Added
- **Profile-based agent routing** — active profile now filters available agents in `smartRoute()` and `resolve()`, making profiles affect actual behavior
- **Telemetry-enhanced routing** — `smartRoute()` includes agent success rates and response times as hints for the LLM router, preferring reliable agents
- **Full conversation persistence** — agent responses are now saved in full (up to 10k chars) instead of stubs, enabling meaningful conversation replay
- **Conversation context injection** — prior conversation history (last 8 messages, max 2000 chars) is automatically injected into `workspaceContext` for agent continuity
- **`buildConversationContext()` method** on `ConversationPersistence` — formats recent messages as structured context for agents
- **18 new unit tests** — profile routing (11 tests), conversation context builder (7 tests)

### Changed
- `AgentRegistry.resolve()` accepts optional `profileAgents` parameter for profile-aware routing
- `AgentRegistry.smartRoute()` accepts options object with `profileAgents` and `telemetryStats`
- Handler in `extension.ts` now passes active profile agents and telemetry stats to routing
- Workspace context now includes both git/diagnostics context and conversation history

### Improved
- Total tests: 698 across 34 test files (up from 680/32)
- Overall test coverage: 44.85% (up from 44.22%)

## [0.2.0] - 2025-07-09

### Added
- **111 new unit tests** — total now 680 across 32 test files
- Test coverage for statusbar module (100%)
- Test coverage for marketplace module (33 tests)
- Test coverage for CodeLens provider (19 tests)
- Test coverage for tree view provider (15 tests)
- Test coverage for streaming/history utilities (12 tests)
- Test coverage for system prompts (10 tests)
- Utils barrel export (`src/utils/index.ts`)

### Fixed
- VS Code mock: added `CodeLens`, `ThemeColor`, `TreeItem`, `TreeItemCollapsibleState`, `ChatRequestTurn` classes
- Test files using `require('vscode')` replaced with proper ESM imports
- Case-sensitive assertion in system prompts test

### Improved
- Overall test coverage from 38.71% to 44.22%
- Five previously untested modules now have comprehensive test suites

## [0.1.0] - 2025-02-10

### Added
- **30+ specialized agents** for code, docs, testing, security, performance, architecture, and more
- **Autonomous agents** (scaffold, autofix, devops, database, migrate, component, fullstack)
- **Smart auto-router** using LLM to route prompts to the best agent automatically
- **Workflow engine** with predefined pipelines: quality-check, ship-feature, fix-and-verify
- **Agent collaboration** with voting, debate, and consensus modes
- **Agent memory** with persistent cross-session knowledge
- **Middleware pipeline** with timing, rate-limiting, and usage tracking
- **Guard rails** with dry-run mode, checkpoints, and undo support
- **Plugin system** with hot-reload for custom agents
- **Response cache** with LRU eviction and TTL
- **Internationalization** (English + Swedish)
- **Agent profiles & presets** for context-specific agent configurations
- **Conversation persistence** across sessions
- **Telemetry & analytics dashboard** (local only)
- **External integrations** (GitHub, Jira, Slack)
- **Agent marketplace** for discovering and installing community agents
- **Status bar** with live agent activity, memory stats, cache info
- **Sidebar tree view** with categorized agent explorer
- **CodeLens integration** for inline agent actions
- **Snippet library** for saving and reusing agent outputs
- **Notification center** for agent events
- **Diff preview** before applying agent changes
- **Multi-model support** (GPT, Claude, etc.)
- **Meta-agent** `/create-agent` for generating new agents dynamically
- **Test runner agent** with self-correction loop
- **Event-driven agents** reacting to file saves, diagnostics, etc.
- **Project config** via `.agentrc.json`
- **16 VS Code settings** for fine-grained control
- **8 keyboard shortcuts** for quick access
- **6-step walkthrough** for onboarding
- **Welcome view** in Agent Explorer sidebar
- **85 unit tests** with Vitest
- **E2E test infrastructure** with @vscode/test-electron
- **CI/CD pipeline** with GitHub Actions

### Infrastructure
- TypeScript 5.3+ with strict mode
- VS Code engine ^1.93.0 (Chat Participant API)
- Vitest for unit testing with V8 coverage
- ESLint with TypeScript support
- GitHub Actions CI (Node 18 + 20)
- VSIX packaging ready
