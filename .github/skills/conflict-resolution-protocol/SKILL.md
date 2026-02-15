---
name: "Conflict Resolution Protocol"
description: "Resolve agent conflicts: scope ownership check, quality gate arbitration, semantic diff, merge strategy, audit trail via AgentCollaboration"
argument-hint: "Conflict to resolve"
---

# Conflict Resolution Protocol

Resolve conflicts when multiple agents produce overlapping or contradictory outputs. Uses `AgentCollaboration` for voting, debate, and consensus — with audit trails and quality gate arbitration.

## Workflow

1. **Detect** the conflict — overlapping file edits, contradictory suggestions, or routing ambiguity.
2. **Classify** — scope conflict (two agents claim same file), output conflict (different suggestions for same problem), or routing conflict (multiple agents match).
3. **Resolve** using the appropriate strategy (ownership, voting, quality gate).
4. **Audit** — record the resolution in the collaboration log.
5. **Validate** — `npm run compile && npm test`.

## Conflict Types

| Type | Example | Resolution |
|------|---------|------------|
| Scope overlap | `refactor` and `perf` both modify same function | Ownership check by agent description |
| Output conflict | `review` says "add tests", `code` says "simplify" | Voting via `AgentCollaboration` |
| Routing ambiguity | Smart router scores two agents equally | First registered wins (registry order) |
| Merge conflict | Parallel workflow agents produce incompatible diffs | Semantic diff + manual arbitration |
| Priority conflict | Workflow step order disagreement | Workflow engine sequencing rules |

## Templates

### Scope ownership check

```typescript
// In AgentCollaboration (src/collaboration/agent-collaboration.ts)
function resolveOwnership(
    agents: BaseAgent[],
    targetFile: string
): BaseAgent {
    // Agents declare scope via their description
    const scopeMap: Record<string, string[]> = {
        'test': ['*.test.ts', '*.spec.ts'],
        'security': ['**/auth/**', '**/crypto/**'],
        'database': ['**/models/**', '**/migrations/**'],
        'a11y': ['**/components/**']
    };

    for (const agent of agents) {
        const patterns = scopeMap[agent.id] || [];
        if (patterns.some(p => matchGlob(targetFile, p))) {
            return agent;
        }
    }
    return agents[0]; // fallback to first
}
```

### Multi-agent voting

```typescript
// AgentCollaboration supports voting for conflict resolution
const collaboration = new AgentCollaboration(registry);

const result = await collaboration.vote({
    question: 'Should this function be split into smaller functions?',
    voters: ['review', 'refactor', 'perf'],
    context: { code: functionSource, file: filePath }
});

// result.decision — majority vote outcome
// result.votes — individual agent votes with reasoning
// result.confidence — agreement ratio (0-1)
```

## Rules

- `AgentCollaboration` is at `src/collaboration/agent-collaboration.ts` — use it for voting and debate.
- Smart routing in `AgentRegistry` (`src/agents/index.ts`) breaks ties by registration order.
- Workflow parallel groups in `WorkflowEngine` may produce conflicting outputs — always merge explicitly.
- `GuardRails` checkpoints should be created before applying any conflict resolution changes.
- User-facing conflict messages must be in **Swedish**.
- Audit logs go to a dedicated OutputChannel, not the main agent stream.
- Quality gate checks: `npm run compile` (types), `npm run lint` (style), `npm test` (behavior).

## Checklist

- [ ] Conflict type classified (scope, output, routing, merge, priority)
- [ ] Appropriate resolution strategy selected
- [ ] `AgentCollaboration` used for multi-agent decisions
- [ ] GuardRails checkpoint created before applying resolution
- [ ] Audit trail entry logged with conflict type, agents, and outcome
- [ ] Quality gate passed after resolution: `npm run compile && npm run lint && npm test`
- [ ] User notified of resolution in Swedish
