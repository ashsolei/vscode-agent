# Changelog

All notable changes to the **VS Code Agent** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
