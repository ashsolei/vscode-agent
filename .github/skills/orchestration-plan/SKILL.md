---
name: "Orchestration Plan"
description: "Plan multi-agent orchestration: task decomposition, agent assignment, execution ordering, quality gates, conflict prevention using WorkflowEngine"
argument-hint: "Goal to orchestrate"
---

# Orchestration Plan

Plan and execute multi-agent orchestrations for the VS Code Agent extension. Decompose complex goals into ordered agent steps, assign agents from the 30+ registered in `AgentRegistry`, define execution order and quality gates, and prevent conflicts between concurrent agents.

## Workflow

1. **Decompose** the goal into discrete tasks that map to existing agents (see `src/agents/`).
2. **Assign agents** — pick the right agent by `id` (e.g., `code`, `test`, `security`, `refactor`).
3. **Define ordering** — use `WorkflowStep.pipeOutput` to chain outputs, `parallelGroup` for concurrent steps, and `WorkflowCondition` for branching.
4. **Add quality gates** — insert verification steps (compile, lint, test) between mutation steps.
5. **Register the workflow** — add a `WorkflowDefinition` to `.agentrc.json` under `workflows`.
6. **Execute** via `WorkflowEngine.run()` and inspect `WorkflowStepResult[]`.

## Templates

### Sequential pipeline (plan → implement → test → review)

```json
{
  "name": "feature-pipeline",
  "description": "End-to-end feature delivery",
  "steps": [
    { "name": "plan", "agentId": "planner", "prompt": "Break down: {{goal}}" },
    { "name": "implement", "agentId": "code", "prompt": "Implement the plan", "pipeOutput": true },
    { "name": "test", "agentId": "test", "prompt": "Write Vitest tests for the changes", "pipeOutput": true },
    { "name": "review", "agentId": "review", "prompt": "Review the implementation", "pipeOutput": true }
  ]
}
```

### Parallel group (lint + security scan in parallel)

```json
{
  "steps": [
    { "name": "lint", "agentId": "code", "prompt": "Run lint", "parallelGroup": "checks" },
    { "name": "security", "agentId": "security", "prompt": "Scan for vulnerabilities", "parallelGroup": "checks" },
    { "name": "report", "agentId": "status", "prompt": "Summarize results", "pipeOutput": true }
  ]
}
```

### Conditional step (retry on failure)

```json
{
  "name": "autofix", "agentId": "autofix", "prompt": "Fix lint errors",
  "condition": { "ifStep": 0, "is": "failed" },
  "retries": 2
}
```

## Rules

- Every workflow **must** have at least one quality-gate step (compile, lint, or test).
- Autonomous agents (`isAutonomous: true`) require a `GuardRails.createCheckpoint()` before execution.
- Use `pipeOutput: true` only when the next step genuinely needs the previous output as context.
- Parallel groups share the same `parallelGroup` string; the engine waits for all before continuing.
- Never hardcode agent lists — use `registry.list()` to discover available agents at runtime.
- Workflows are defined in `.agentrc.json` and loaded by `ConfigManager` (`src/config/config-manager.ts`).
- Smart routing fallback is the `code` agent — design workflows that tolerate this.

## Checklist

- [ ] Goal decomposed into ≤ 8 discrete steps
- [ ] Each step maps to a registered agent in `src/agents/`
- [ ] Execution order respects data dependencies (`pipeOutput`)
- [ ] Quality gate inserted after every mutation step
- [ ] `parallelGroup` used where steps are independent
- [ ] `condition` and `retries` set for fallible steps
- [ ] Workflow definition valid against `WorkflowDefinition` interface (`src/workflow/workflow-engine.ts`)
- [ ] GuardRails checkpoint created before autonomous steps
- [ ] Tested with `WorkflowEngine.run()` and results inspected
- [ ] No runtime dependencies added
