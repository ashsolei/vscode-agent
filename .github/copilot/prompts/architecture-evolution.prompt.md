---
mode: "agent"
description: "Plan architecture evolution — assess current state (BaseAgent, AgentRegistry, etc.), define target state, create migration path"
---

# Architecture Evolution Plan

You are a software architect for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, AgentRegistry, MiddlewarePipeline, WorkflowEngine, GuardRails, ModelSelector).

## Steps

1. **Assess current architecture**
   - Map the core modules and their relationships:
     - `BaseAgent` → all 30+ agents inherit from it.
     - `AgentRegistry` → routing, chaining, parallel execution, `smartRoute()`.
     - `MiddlewarePipeline` → before/after/onError hooks.
     - `ContextProviderRegistry` → git diff, diagnostics, selection, dependencies.
     - `WorkflowEngine` → multi-agent pipelines, conditions, retry, parallel groups.
     - `ModelSelector` → per-agent model routing via `.agentrc.json`.
     - `GuardRails` → checkpoint/rollback for autonomous agents.
   - Measure module sizes and coupling:
   ```bash
   wc -l src/extension.ts src/agents/base-agent.ts src/agents/index.ts src/middleware/middleware.ts src/models/model-selector.ts
   ```
   - Identify pain points: `extension.ts` as a bottleneck, registration boilerplate, tight coupling.

2. **Define the target architecture**
   - Goal: modular, extensible, easy to add/remove agents without touching `extension.ts`.
   - Proposed changes:
     - Auto-discovery of agents via file convention (scan `src/agents/*-agent.ts`).
     - Lazy agent loading — instantiate agents on first use, not at activation.
     - Middleware as composable decorators rather than a central pipeline.
     - Plugin-based architecture: agents as self-contained modules with metadata.
   - Maintain zero runtime deps constraint throughout.

3. **Gap analysis: current vs target**
   - List specific gaps between current and target state.
   - For each gap: current behavior, target behavior, migration complexity (S/M/L/XL).
   - Identify breaking changes that affect `.agentrc.json` configuration or `package.json` commands.
   - Flag backward-compatibility requirements.

4. **Create the migration path**
   - **Phase 1**: Introduce agent auto-discovery alongside manual registration. Both coexist.
   - **Phase 2**: Migrate agents to self-registering pattern with metadata exports.
   - **Phase 3**: Remove manual registration from `extension.ts`.
   - **Phase 4**: Implement lazy loading and plugin architecture.
   - Each phase must pass: `npm run compile && npm test && npm run lint`.

5. **Prototype Phase 1**
   ```bash
   npm run compile && npm test
   ```
   - Implement auto-discovery scanner in `src/agents/index.ts`.
   - Test that existing manual registration still works alongside auto-discovery.
   - Use `GuardRails` checkpoints before each major refactor step.

6. **Document the evolution plan**
   - Write architecture decision records (ADRs) for major changes.
   - Update `copilot-instructions.md` with new architecture patterns.
   - Update `CAPABILITY-REGISTRY.md` and `CHANGELOG.md`.
   - Communicate breaking changes to users via `CHANGELOG.md`.

## Quality Checklist
- [ ] Current architecture fully mapped with module sizes and dependencies
- [ ] Target architecture defined with clear rationale for each change
- [ ] Gap analysis completed with migration complexity estimates
- [ ] Migration path phased — no big-bang rewrites
- [ ] Phase 1 prototyped and verified with test suite
- [ ] Zero runtime deps maintained across all phases
- [ ] Backward compatibility plan for `.agentrc.json` and `package.json`

## Pitfalls to Avoid
- Attempting a single-phase rewrite — always use incremental migration.
- Breaking `.agentrc.json` compatibility without a migration guide.
- Moving to auto-discovery without handling agent registration order (affects `setDefault()`).
- Lazy loading agents that are needed immediately at activation (e.g., event-driven agents).
- Not updating `copilot-instructions.md` — it is the primary architecture reference.
- Removing `GuardRails` checkpoints during migration — they are your safety net.
