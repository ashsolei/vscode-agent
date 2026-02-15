---
name: "Execution Planning"
description: "Transform goals into executable plans: task decomposition, dependency graph, risk assessment, effort estimation, critical path analysis using WorkflowEngine"
argument-hint: "Goal to plan"
---

# Execution Planning

Transform high-level goals into executable, dependency-aware plans for the VS Code Agent extension. Uses `WorkflowEngine` (`src/workflow/workflow-engine.ts`) for multi-agent pipelines and includes risk assessment and critical path analysis.

## Workflow

1. **Decompose** the goal into discrete tasks — each mappable to an agent or manual action.
2. **Identify** dependencies — which tasks block others, which can run in parallel.
3. **Estimate** effort — T-shirt sizes (S/M/L/XL) mapped to time ranges.
4. **Assess** risks — what can go wrong, likelihood, impact, mitigation.
5. **Build** the dependency graph — identify the critical path.
6. **Configure** `WorkflowEngine` pipeline if tasks involve multiple agents.
7. **Validate** the plan — dry run with `GuardRails` (`src/guardrails/guardrails.ts`).
8. **Execute** — run the plan, track progress, adjust as needed.

## Templates

### Task decomposition template

```markdown
## Goal: [High-level goal]

### Tasks
| ID  | Task                          | Agent       | Effort | Depends On | Risk   |
|-----|-------------------------------|-------------|--------|------------|--------|
| T1  | Analyze current architecture  | architect   | M      | —          | Low    |
| T2  | Design new module interface   | architect   | L      | T1         | Medium |
| T3  | Implement module              | code        | XL     | T2         | High   |
| T4  | Write unit tests              | test        | L      | T3         | Low    |
| T5  | Security review               | security    | M      | T3         | Medium |
| T6  | Update documentation          | docgen      | S      | T3         | Low    |
| T7  | Integration testing           | testrunner  | M      | T4, T5     | Medium |

### Critical Path: T1 → T2 → T3 → T4/T5 → T7
### Parallel Groups: [T4, T5, T6] can run after T3
```

### WorkflowEngine pipeline configuration

```json
{
  "workflows": {
    "feature-implementation": {
      "steps": [
        { "agent": "architect", "prompt": "Analysera och designa", "id": "design" },
        { "agent": "code", "prompt": "Implementera", "dependsOn": ["design"], "id": "impl" },
        { "parallel": ["test", "security", "docgen"], "dependsOn": ["impl"] },
        { "agent": "review", "prompt": "Slutgranskning", "dependsOn": ["test", "security"], "id": "review" }
      ]
    }
  }
}
```

### Risk assessment matrix

```markdown
| Risk                           | Likelihood | Impact | Mitigation                        |
|--------------------------------|-----------|--------|-----------------------------------|
| VS Code API breaking change    | Low       | High   | Pin ^1.93.0, test on update       |
| Model quality regression       | Medium    | Medium | A/B test, fallback chain          |
| Path traversal in executor     | Low       | High   | validatePath() in executor        |
```

### Effort estimation reference

| Size | Range     | Examples                                |
|------|-----------|-----------------------------------------|
| S    | 1-2h      | Prompt update, config option, typo fix  |
| M    | 2-8h      | Middleware hook, refactor agent         |
| L    | 1-3d      | New agent, skill, workflow pipeline     |
| XL   | 3-5d      | Architecture change, new module         |

## Rules

- Every plan must have a dependency graph — no unordered task lists.
- Critical path determines minimum completion time — optimize it first.
- `WorkflowEngine` (`src/workflow/workflow-engine.ts`) handles multi-agent pipelines with conditions, retry, and parallel groups.
- Parallel tasks must be truly independent — no shared mutable state.
- Risk assessment is mandatory for L and XL tasks — optional for S and M.
- `GuardRails` (`src/guardrails/guardrails.ts`) provides checkpoint snapshots for autonomous execution — use dry-run for validation.
- Effort estimates use T-shirt sizes, not hours — hours are ranges, not commitments.
- Plans reference real agents from `AgentRegistry` (`src/agents/index.ts`) — all 30+ agents are available.
- Validate plans with: `npm run compile && npm test` before execution.
- Track execution progress — update task status as tasks complete.

## Checklist

- [ ] Goal clearly stated and scoped
- [ ] Tasks decomposed with agent assignments
- [ ] Dependencies identified — no circular dependencies
- [ ] Critical path calculated
- [ ] Parallel groups identified for concurrent execution
- [ ] Effort estimated (S/M/L/XL) for each task
- [ ] Risks assessed for L/XL tasks with mitigations
- [ ] `WorkflowEngine` pipeline configured if multi-agent
- [ ] `GuardRails` dry-run completed for autonomous tasks
- [ ] Plan validated: `npm run compile && npm test`
