---
name: "Agent Collaboration"
description: "Set up multi-agent collaboration patterns — voting, debate, consensus, and delegation using AgentCollaboration"
argument-hint: "What collaboration pattern? e.g. 'code review with voting' or 'architecture debate between agents'"
---

# Agent Collaboration Skill

Configure multi-agent collaboration using `AgentCollaboration` in `src/collaboration/agent-collaboration.ts`.

## Collaboration Modes

### 1. Voting
Multiple agents independently answer the same question. Results are compared and the most common answer wins.

```
@agent /vote Which pattern should we use for error handling?
```

Agents involved: configurable (default: code, architect, review)

**How it works:**
1. Same prompt sent to N agents in parallel
2. Each agent produces an independent response
3. Responses are compared for consensus
4. Majority answer presented to user with confidence score

### 2. Debate
Agents argue different positions on a topic. Each agent sees the previous responses.

```
@agent /debate Should we use classes or functions for agents?
```

**How it works:**
1. Each agent receives the prompt + all previous responses
2. Agents argue FOR their perspective
3. A "judge" agent (default: architect) synthesizes the debate
4. Final recommendation presented with supporting arguments

### 3. Consensus
Iterative refinement where agents build on each other's output until agreement.

```
@agent /consensus Design the error handling strategy
```

**How it works:**
1. First agent produces initial proposal
2. Next agent critiques and improves
3. Process repeats until convergence or max rounds
4. Final consensus output presented

### 4. Delegation
An orchestrator agent routes sub-tasks to specialist agents.

```
@agent /delegate Build a complete user authentication module
```

**How it works:**
1. Orchestrator agent (planner) analyzes the task
2. Breaks into sub-tasks and assigns to specialists
3. Each specialist completes their part
4. Orchestrator assembles and reviews the result

## Configuration

### Via Chat Commands
```
@agent /vote <prompt>       → Multi-agent voting
@agent /debate <prompt>     → Agent debate
@agent /consensus <prompt>  → Iterative consensus
@agent /delegate <prompt>   → Task delegation
```

### Via .agentrc.json
```json
{
    "collaboration": {
        "votingAgents": ["code", "architect", "review"],
        "debateAgents": ["code", "architect", "security"],
        "judgeAgent": "architect",
        "maxDebateRounds": 3,
        "consensusThreshold": 0.8,
        "maxConsensusRounds": 5
    }
}
```

## Implementation Details

```typescript
// src/collaboration/agent-collaboration.ts
class AgentCollaboration {
    constructor(
        private registry: AgentRegistry,
        private pipeline: MiddlewarePipeline
    ) {}

    async vote(prompt: string, ctx: AgentContext, agents?: string[]): Promise<AgentResult>
    async debate(prompt: string, ctx: AgentContext, agents?: string[]): Promise<AgentResult>
    async consensus(prompt: string, ctx: AgentContext, agents?: string[]): Promise<AgentResult>
    async delegate(prompt: string, ctx: AgentContext): Promise<AgentResult>
}
```

## Example: Architecture Decision

```
User: @agent /debate Should extension.ts be split into smaller modules?

Agent 1 (architect): "Yes, split. 500+ lines violates SRP. Recommend: 
  setup/register-agents.ts, setup/register-commands.ts, setup/create-handler.ts"

Agent 2 (developer): "Partially agree. Split registration, but keep handler 
  in extension.ts for VS Code discoverability."

Agent 3 (performance): "Concerned about import overhead from splitting. 
  30+ agent imports already slow activation."

Judge (architect): "Consensus: Split registration into setup/ module, keep 
  handler in extension.ts. Use lazy imports to address activation time."
```

## Rules

- All participating agents must be registered and non-disabled
- Voting uses parallel execution for speed
- Debate rounds are sequential (each sees previous responses)
- Consensus has a max round limit to prevent infinite loops
- Rate limiting applies to each agent call individually
- Cancellation token is checked between rounds
