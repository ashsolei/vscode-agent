---
name: "Priority Framework"
description: "Prioritize work systematically: RICE scoring, strategic alignment, risk-weighted ranking, conflict resolution between agents. Output: ranked backlog."
argument-hint: "Items to prioritize"
---

# Priority Framework

Systematically prioritize work items for the VS Code Agent extension using RICE scoring, strategic alignment, risk-weighted ranking, and inter-agent conflict resolution. Output: a ranked backlog ready for execution planning.

## Workflow

1. **Collect** candidate items — from gap analysis, capability discovery, bug reports, feature requests, agent feedback.
2. **Score** each item using RICE — Reach, Impact, Confidence, Effort.
3. **Align** with strategy — does the item advance the extension's goals (more agents, better quality, broader model support)?
4. **Adjust** for risk — high-risk items get a risk multiplier that may lower their rank.
5. **Resolve** conflicts — when multiple agents or modules compete for the same resources.
6. **Rank** — produce the final ordered backlog.
7. **Review** — validate ranking with stakeholders or automated metrics.

## Templates

### RICE scoring template

```markdown
## Item: [Name]

| Factor     | Score | Rationale                                          |
|-----------|-------|---------------------------------------------------|
| Reach     | X/5   | How many agents/users benefit? (1=few, 5=all)      |
| Impact    | X/5   | How much improvement? (1=minimal, 5=transformative) |
| Confidence| X/5   | How certain are we? (1=guess, 5=proven)             |
| Effort    | X/5   | Inverse effort (1=months, 5=hours)                  |

**RICE Score:** Reach × Impact × Confidence × Effort = XX/625
**Risk Multiplier:** 1.0 (no risk) / 0.8 (medium) / 0.5 (high)
**Adjusted Score:** XX
```

### Prioritized backlog format

```markdown
## Ranked Backlog — 2026-02-15

| Rank | Item                          | RICE  | Risk | Adjusted | Agent/Module        | Status   |
|------|-------------------------------|-------|------|----------|---------------------|----------|
| 1    | Optimize review agent prompt  | 375   | 1.0  | 375      | review              | Ready    |
| 2    | Add infra-agent               | 300   | 0.8  | 240      | new agent           | Planning |
| 3    | Improve smart routing         | 250   | 1.0  | 250      | AgentRegistry       | Ready    |
| 4    | Claude extended thinking      | 200   | 0.8  | 160      | ModelSelector       | Eval     |
| 5    | MCP filesystem server         | 180   | 0.5  | 90       | ToolRegistry        | Blocked  |
```

### Conflict resolution process

```markdown
## Conflict: [Description]
- **Competing items:** A vs B | **Shared resource:** Dev time / config / pipeline
- **Resolution:** 1) Higher RICE wins 2) Alignment breaks tie 3) Lower risk 4) Smaller effort
- **Decision:** Item [A/B] — rationale: ...
```

### Strategic alignment scoring

```markdown
Goals: 1) Agent coverage 2) Response quality 3) Resilience 4) Cost reduction 5) Developer experience

| Item                    | G1 | G2 | G3 | G4 | G5 | Total |
|-------------------------|----|----|----|----|----|----- -|
| Add infra-agent         | 5  | 0  | 0  | 0  | 2  | 7     |
| Optimize review prompt  | 0  | 5  | 0  | 0  | 3  | 8     |
| Improve smart routing   | 2  | 3  | 2  | 1  | 4  | 12    |
```

## Rules

- RICE scoring is mandatory for all items — no ad-hoc prioritization.
- Scores are relative within the backlog — recalibrate when new items are added.
- Risk multipliers: 1.0 (low risk), 0.8 (medium — may break existing tests), 0.5 (high — architecture change or security concern).
- Conflict resolution follows the four-step process: RICE → alignment → risk → effort.
- Backlog is re-ranked after every sprint or major change — stale rankings cause misallocation.
- Items scoring below 50/625 adjusted go to the icebox — revisit quarterly.
- Agent-specific items reference their source file: `src/agents/<name>-agent.ts`.
- Module-level items reference: `AgentRegistry` (`src/agents/index.ts`), `MiddlewarePipeline` (`src/middleware/middleware.ts`), `ModelSelector` (`src/models/model-selector.ts`), `WorkflowEngine` (`src/workflow/workflow-engine.ts`).
- Prioritization decisions must be documented — no silent re-ordering.
- Use `execution-planning` skill to turn top-ranked items into actionable plans.

## Checklist

- [ ] All candidate items collected from relevant sources
- [ ] RICE score calculated for each item
- [ ] Strategic alignment assessed
- [ ] Risk multiplier applied
- [ ] Conflicts identified and resolved
- [ ] Final ranking produced and documented
- [ ] Top items have execution plans (see `execution-planning` skill)
- [ ] Low-scoring items moved to icebox with rationale
- [ ] Backlog reviewed and validated
- [ ] Next sprint items selected from top of ranked backlog
