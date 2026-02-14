# Changelog

All notable changes to the **VS Code Agent** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-14

### Changed
- Upgraded Vitest from 2.x to 3.2.4 for latest test runner improvements
- Upgraded @vitest/coverage-v8 to 3.2.4
- Pinned TypeScript to ~5.5.0 for full eslint compatibility

### Fixed
- Resolved all npm audit security vulnerabilities (8 → 0)
  - Fixed esbuild development server request vulnerability (GHSA-67mh-4wv8-2f99)
  - Fixed markdown-it ReDoS vulnerability (GHSA-38c4-r59v-3vqw)
  - Fixed qs arrayLimit bypass (GHSA-w7fw-mjwx-w883)

### Added
- Dockerfile with multi-stage build (build → package → runtime)
- .dockerignore for optimized Docker builds
- Docker build and push instructions in README

### Infrastructure
- All 99 unit tests passing on Vitest 3.2.4
- Zero npm audit vulnerabilities
- Clean TypeScript compilation with strict mode
- Clean ESLint pass with no warnings

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
