---
name: "Agent System Evolution"
description: "Self-improve the agent system: performance analysis, gap identification, agent creation/retirement, prompt optimization. Follows EVOLUTION-PROTOCOL.md."
argument-hint: "Aspect to evolve"
---

# Agent System Evolution

Systematically evolve the VS Code Agent extension's agent system — analyze performance, identify gaps, create or retire agents, optimize prompts, and refine architecture. Governed by `EVOLUTION-PROTOCOL.md`.

## Workflow

1. **Analyze** current performance — usage metrics, response quality, error rates from `AgentDashboard` (`src/dashboard/agent-dashboard.ts`).
2. **Identify** gaps — unhandled user intents, poor routing accuracy, missing capabilities.
3. **Prioritize** improvements — use RICE scoring (see `priority-framework` skill).
4. **Plan** changes — agent creation, retirement, prompt rewrites, middleware additions.
5. **Implement** — follow `create-agent` skill for new agents, update `src/prompts/system-prompts.ts` for prompts.
6. **Test** — `npm run compile && npm test && npm run lint`.
7. **Validate** — compare before/after metrics.
8. **Document** — update `EVOLUTION-PROTOCOL.md`, `CAPABILITY-REGISTRY.md`, `CHANGELOG.md`.

## Templates

### Performance analysis report

```markdown
## Agent System Health — 2026-02-15
### Usage Distribution
| Agent     | Invocations | Avg Latency | Error Rate | Satisfaction |
|-----------|------------|-------------|------------|-------------|
| code      | 450        | 2.1s        | 0.4%       | 4.2/5       |
| explain   | 280        | 1.3s        | 0.1%       | 4.5/5       |
| review    | 120        | 3.8s        | 1.2%       | 3.8/5       |

### Gaps Identified
1. No agent handles infrastructure-as-code tasks
2. `review` agent error rate too high — prompt needs optimization
3. Smart routing misroutes 8% of requests — `AgentRegistry.smartRoute()` needs tuning

### Recommendations
1. Create `infra-agent` (priority: 75/125)
2. Rewrite `review` agent system prompt (priority: 90/125)
3. Improve routing descriptions for ambiguous agents (priority: 60/125)
```

### Agent retirement checklist

```markdown
- [ ] Confirm zero/near-zero usage (30 days)
- [ ] Verify no WorkflowEngine pipeline dependencies
- [ ] Remove from AgentRegistry in src/extension.ts + slash command in package.json
- [ ] Delete src/agents/<name>-agent.ts and test file
- [ ] Update CHANGELOG.md under "Borttaget", run npm run compile && npm test
```

### Prompt optimization cycle

```typescript
// 1. Baseline: capture current output quality
// 2. Modify prompt in src/prompts/system-prompts.ts
// 3. Test with representative inputs
// 4. Compare quality metrics
// 5. If improved, commit. If not, revert.
```

### Smart routing improvement

```typescript
// In src/agents/<name>-agent.ts — description must be specific for smartRoute()
constructor() {
    super('agent-name', 'Tydlig, distinkt beskrivning', { isAutonomous: false });
}
```

## Rules

- `EVOLUTION-PROTOCOL.md` is the governing document for system evolution — follow its processes.
- Agent creation follows the `create-agent` skill — `src/agents/<name>-agent.ts`, extend `BaseAgent`.
- Agent retirement requires zero/near-zero usage proof and no downstream dependencies.
- Prompt changes must be measured — before/after quality comparison is mandatory.
- Smart routing accuracy depends on agent `description` quality — descriptions must be specific and non-overlapping.
- `AgentRegistry` (`src/agents/index.ts`) handles routing, chaining, and unregistration.
- Never remove agents that other agents or `WorkflowEngine` (`src/workflow/workflow-engine.ts`) pipelines depend on.
- All evolution changes require: `npm run compile && npm test && npm run lint`.
- Document all changes in `CHANGELOG.md` using Swedish categories (Tillagt, Ändrat, Borttaget).
- Evolution is iterative — small, measured improvements over large rewrites.

## Checklist

- [ ] Performance data collected from `AgentDashboard`
- [ ] Gaps identified and documented
- [ ] Improvements prioritized using RICE scoring
- [ ] Changes planned — creation, retirement, prompt optimization, routing fixes
- [ ] Implementation follows project conventions (`BaseAgent`, `package.json` commands, etc.)
- [ ] Tests pass: `npm run compile && npm test && npm run lint`
- [ ] Before/after metrics compared
- [ ] `EVOLUTION-PROTOCOL.md` updated with evolution record
- [ ] `CAPABILITY-REGISTRY.md` updated if capabilities changed
- [ ] `CHANGELOG.md` updated
