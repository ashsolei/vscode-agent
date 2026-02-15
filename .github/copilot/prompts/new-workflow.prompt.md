---
mode: "agent"
description: "Create a multi-agent workflow — sequential or parallel agent pipeline with conditions, retry, and output piping"
---

# Create Workflow

Design a multi-agent workflow using the WorkflowEngine.

## Workflow Definition

```typescript
interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
  variables?: Record<string, string>;
}

interface WorkflowStep {
  name: string;
  agentId: string;
  prompt: string;
  pipeOutput?: boolean;      // Use previous step's output as prompt
  condition?: string;        // Skip if condition not met
  parallelGroup?: string;    // Group for parallel execution
  retries?: number;          // Retry on failure
}
```

## Built-in Workflows

Available via slash commands:
- `/workflow-quality` → `review` → `test` → `security` → `perf`
- `/workflow-ship` → `plan` → `scaffold` → `code` → `test` → `docgen` → `review`
- `/workflow-fix` → `autofix` → `testrunner` → `security`

## Custom Workflow in `.agentrc.json`

```json
{
  "workflows": {
    "my-workflow": {
      "name": "My Workflow",
      "description": "What this workflow does",
      "steps": [
        {
          "name": "Step 1",
          "agentId": "review",
          "prompt": "Review all changes"
        },
        {
          "name": "Step 2",
          "agentId": "test",
          "prompt": "Write tests for reviewed code",
          "pipeOutput": true
        },
        {
          "name": "Step 3a",
          "agentId": "security",
          "prompt": "Security scan",
          "parallelGroup": "checks"
        },
        {
          "name": "Step 3b",
          "agentId": "perf",
          "prompt": "Performance analysis",
          "parallelGroup": "checks"
        }
      ]
    }
  }
}
```

## Programmatic Usage

```typescript
const result = await workflowEngine.run(
  WorkflowEngine.qualityCheck(),
  ctx
);
```

## Rules

- Each step's agent must be registered in the AgentRegistry
- `pipeOutput: true` replaces the step's prompt with the previous step's output
- Steps in the same `parallelGroup` run concurrently
- `retries` defaults to 0 — set higher for flaky operations
- `condition` is evaluated as a simple expression against workflow variables
