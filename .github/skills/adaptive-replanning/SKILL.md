---
name: adaptive-replanning
description: "Re-plan execution when assumptions change, new information arrives, or tasks fail. Includes trigger conditions, re-assessment workflow, stakeholder communication, plan versioning, and rollback to previous plan."
argument-hint: "[trigger-reason] [plan-id]"
---

# Adaptive Replanning

When execution reveals new information — a task fails, a dependency is missing, scope changes, or an assumption proves wrong — this skill provides a structured workflow for re-planning without losing progress or creating chaos.

## Trigger Conditions

Re-plan when ANY of the following occur:

1. **Task failure** — a task fails after retry + fallback exhausted
2. **Assumption invalidation** — a planning assumption proves false (e.g., API doesn't exist, library incompatible)
3. **Scope change** — new requirements arrive or existing ones change
4. **Dependency shift** — an upstream task produces unexpected output
5. **Resource constraint** — time/cost/context budget exceeded
6. **Quality gate failure** — a gate fails that blocks downstream tasks
7. **New information** — discovery of tech debt, security issue, or architectural constraint

## Re-Assessment Workflow

### Step 1 — Freeze Current Execution

```
Stop all in-progress tasks (mark as paused)
Snapshot current state:
  - completed_tasks: [list]
  - paused_tasks: [list]
  - pending_tasks: [list]
  - trigger_reason: "..."
  - impact_assessment: "..."
```

### Step 2 — Impact Analysis

Evaluate the trigger against the remaining plan:

```json
{
  "trigger": "Description of what changed",
  "affected_tasks": ["task-ids that are impacted"],
  "unaffected_tasks": ["task-ids that can proceed"],
  "new_tasks": ["tasks that need to be added"],
  "removed_tasks": ["tasks that are no longer needed"],
  "risk_change": "How the risk profile has changed"
}
```

### Step 3 — Generate Plan Alternatives

Produce 2-3 alternative revised plans:

| Alternative | Approach | Risk | Effort | Trade-offs |
|---|---|---|---|---|
| A — Minimal adjust | Change only affected tasks | Low | Low | May not fully address the trigger |
| B — Partial re-plan | Re-plan the affected branch | Medium | Medium | Balanced approach |
| C — Full re-plan | Re-plan from scratch with new info | High | High | Most thorough but expensive |

### Step 4 — Select and Apply

Choose the alternative that best balances risk, effort, and completeness. Apply the revised plan:

1. Update task graph with new/changed/removed tasks
2. Re-calculate dependencies and critical path
3. Re-assign priorities
4. Resume unaffected tasks
5. Start new/changed tasks

### Step 5 — Version the Plan

```markdown
## Plan Version History
| Version | Date | Trigger | Changes | Decision |
|---|---|---|---|---|
| v1.0 | 2026-02-15 | Initial plan | N/A | N/A |
| v1.1 | 2026-02-15 | API schema mismatch | Added schema migration task | Alternative B |
```

## Communication Template

When re-planning affects other agents or stakeholders:

```
REPLAN NOTICE
  Plan: [plan-id]
  Version: v[old] → v[new]
  Trigger: [what changed]
  Impact: [what tasks are affected]
  Action: [what was changed in the plan]
  Resumed: [tasks resuming]
  New tasks: [tasks added]
  Removed: [tasks dropped]
  ETA change: [if applicable]
```

## Rollback Protocol

If the revised plan also fails:

1. Check if previous plan version is still viable
2. If yes, rollback to that version and resume
3. If no, escalate to orchestrator with full history
4. Never rollback more than 2 versions without orchestrator approval
5. All rollbacks are logged with rationale

## Rules

1. Never re-plan without first freezing in-progress work
2. Always produce at least 2 alternatives before deciding
3. Never discard completed work unless it's provably wrong
4. Document every plan version change
5. Communicate re-plans to affected agents immediately
6. Keep plan version history — never overwrite
7. If re-planning more than 3 times, trigger a retrospective

## Checklist

- [ ] Trigger reason documented
- [ ] Current state frozen and snapshotted
- [ ] Impact analysis completed
- [ ] At least 2 alternatives generated
- [ ] Selected alternative justified
- [ ] Plan version incremented
- [ ] Communication sent to affected agents
- [ ] Unaffected tasks resumed
- [ ] Rollback procedure documented

## Capability Dependencies

- **Extended thinking** — complex re-planning benefits from deep reasoning
- **Tool use** — reading current plan state, updating files
- **Codebase search** — understanding current implementation state

## Evolution Triggers

- Update when orchestration model changes (new layers, new coordination patterns)
- Update when new planning frameworks or methodologies emerge
- Update when failure patterns reveal gaps in the re-planning process

## Model Compatibility

| Model | Suitability | Notes |
|---|---|---|
| Claude | Excellent | Extended thinking for complex re-planning |
| GPT-4 | Good | Structured output for plan alternatives |
| Copilot | Good | IDE integration for task state inspection |
| Gemini | Good | Long context for large plan analysis |
| Local models | Limited | May lack reasoning depth for complex re-plans |
