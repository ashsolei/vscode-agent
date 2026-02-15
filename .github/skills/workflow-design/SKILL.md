---
name: "Workflow Design"
description: "Design multi-agent workflow pipelines using the WorkflowEngine — sequential, parallel, and conditional agent orchestration"
argument-hint: "Describe the workflow. e.g. 'Review code, then fix issues, then run tests'"
---

# Workflow Design Skill

Create multi-agent workflows using the `WorkflowEngine` in `src/workflow/workflow-engine.ts`.

## Architecture

The `WorkflowEngine` orchestrates multiple agents in a pipeline:
- **Sequential**: agents run one after another, output piped as context
- **Parallel groups**: agents with the same `parallelGroup` run concurrently
- **Conditional**: steps can have conditions based on previous results
- **Retry**: individual steps can retry on failure

## Workflow Configuration

Workflows are defined in `.agentrc.json`:

```json
{
    "workflows": {
        "<workflow-name>": {
            "description": "Workflow description",
            "steps": [
                {
                    "agentId": "review",
                    "prompt": "Review this code for issues",
                    "pipeOutput": true
                },
                {
                    "agentId": "security",
                    "prompt": "Check for security vulnerabilities",
                    "parallelGroup": "analysis"
                },
                {
                    "agentId": "perf",
                    "prompt": "Check for performance issues",
                    "parallelGroup": "analysis"
                },
                {
                    "agentId": "autofix",
                    "prompt": "Fix all identified issues",
                    "condition": "hasIssues",
                    "retries": 2
                }
            ]
        }
    }
}
```

## WorkflowStep Interface

```typescript
interface WorkflowStep {
    agentId: string;          // registered agent ID
    prompt: string;           // prompt sent to the agent
    pipeOutput?: boolean;     // pipe this step's output to next step's context
    condition?: string;       // conditional execution
    parallelGroup?: string;   // steps with same group run concurrently
    retries?: number;         // retry count on failure (default: 0)
}
```

## Execution Patterns

### Sequential Pipeline
```json
"steps": [
    { "agentId": "explain", "prompt": "Explain this code", "pipeOutput": true },
    { "agentId": "review",  "prompt": "Review based on explanation", "pipeOutput": true },
    { "agentId": "docgen",  "prompt": "Generate docs from review" }
]
```
Each step receives the previous step's output as context.

### Parallel Analysis
```json
"steps": [
    { "agentId": "security", "prompt": "Security audit", "parallelGroup": "audit" },
    { "agentId": "perf",     "prompt": "Performance audit", "parallelGroup": "audit" },
    { "agentId": "a11y",     "prompt": "Accessibility audit", "parallelGroup": "audit" },
    { "agentId": "review",   "prompt": "Summarize all findings" }
]
```
All "audit" steps run concurrently, then "review" runs with combined output.

### Conditional Steps
```json
"steps": [
    { "agentId": "test",    "prompt": "Run tests", "pipeOutput": true },
    { "agentId": "autofix", "prompt": "Fix failing tests", "condition": "hasFailures", "retries": 3 }
]
```

## Triggering Workflows

Via chat command: `@agent /workflow <workflow-name>`

Or programmatically:
```typescript
const engine = new WorkflowEngine(registry);
await engine.execute('<workflow-name>', ctx);
```

## Example Workflows

### Full Code Review
```json
"full-review": {
    "description": "Comprehensive code review pipeline",
    "steps": [
        { "agentId": "explain",  "prompt": "Explain the architecture" },
        { "agentId": "review",   "prompt": "Code quality review", "parallelGroup": "review" },
        { "agentId": "security", "prompt": "Security review", "parallelGroup": "review" },
        { "agentId": "perf",     "prompt": "Performance review", "parallelGroup": "review" },
        { "agentId": "docgen",   "prompt": "Generate improvement plan", "pipeOutput": true }
    ]
}
```

### Fix and Verify
```json
"fix-verify": {
    "description": "Fix issues and verify with tests",
    "steps": [
        { "agentId": "autofix", "prompt": "Fix the identified issue", "pipeOutput": true },
        { "agentId": "review",  "prompt": "Verify the fix is correct", "pipeOutput": true },
        { "agentId": "test",    "prompt": "Write tests for the fix" }
    ]
}
```

## Rules

- Agent IDs must match registered agents in `AgentRegistry`
- Parallel groups share the same output context
- Conditions reference named conditions in the workflow engine
- Retries use exponential backoff
- Failed steps that aren't retried stop the pipeline
- Maximum 10 steps per workflow to prevent runaway execution
