---
name: "API Contracts"
description: "Define and maintain API contracts: AgentContext/AgentResult interfaces, Middleware hooks, VS Code command signatures, .agentrc.json schema"
argument-hint: "Contract to define or verify"
---

# API Contracts

Define, document, and verify API contracts across the VS Code Agent extension. Covers TypeScript interfaces, middleware hook signatures, VS Code command registrations, and `.agentrc.json` configuration schema.

## Workflow

1. **Identify** the contract boundary — agent interface, middleware hook, command, or config schema.
2. **Define** the contract using TypeScript interfaces and JSDoc.
3. **Enforce** via strict TypeScript compilation and Vitest assertions.
4. **Document** the contract in the relevant module's JSDoc.
5. **Validate** consumers conform to the contract; run `npm run compile`.

## Core Contracts

### `AgentContext` (`src/agents/base-agent.ts`)

```typescript
interface AgentContext {
  request: vscode.ChatRequest;       // User prompt and command
  chatContext: vscode.ChatContext;     // Conversation history
  stream: vscode.ChatResponseStream;  // Response output stream
  token: vscode.CancellationToken;    // Cancellation signal
  workspaceContext?: string;           // Injected by ContextProviderRegistry
}
```

### `AgentResult` (`src/agents/base-agent.ts`)

```typescript
interface AgentResult {
  metadata?: Record<string, unknown>;  // Agent-specific data
  followUps?: vscode.ChatFollowup[];   // Suggested follow-up prompts
}
```

### `Middleware` hooks (`src/middleware/middleware.ts`)

```typescript
interface Middleware {
  name: string;
  priority?: number;  // Lower = runs first, default 100
  before?(info: MiddlewareInfo): Promise<void | 'skip'>;
  after?(info: MiddlewareInfo): Promise<void>;
  onError?(info: MiddlewareInfo): Promise<void>;
}
```

### `WorkflowStep` (`src/workflow/workflow-engine.ts`)

```typescript
interface WorkflowStep {
  name: string;
  agentId: string;
  prompt: string;
  pipeOutput?: boolean;
  condition?: WorkflowCondition;
  parallelGroup?: string;
  retries?: number;
}
```

### `.agentrc.json` schema (`src/config/config-manager.ts`)

```json
{
  "defaultAgent": "string — agent ID",
  "language": "string — e.g. 'sv'",
  "autoRouter": "boolean",
  "disabledAgents": ["string[]"],
  "workflows": { "name": { "steps": [] } },
  "eventRules": [{ "event": "onSave", "filePattern": "**/*.ts", "agentId": "autofix" }],
  "memory": { "enabled": true, "maxAge": 604800000 },
  "guardrails": { "confirmDestructive": true, "dryRunDefault": false },
  "prompts": { "agentId": "custom system prompt" },
  "models": { "agentId": "model-family" }
}
```

## Rules

- **Never change** `AgentContext` or `AgentResult` without updating all 30+ agent implementations.
- Middleware `before` returning `'skip'` must bypass the agent entirely — this is a contract guarantee.
- All agents must extend `BaseAgent` and implement `handle(ctx: AgentContext): Promise<AgentResult>`.
- VS Code commands are declared in `package.json` `contributes.commands` and registered in `src/extension.ts`.
- `.agentrc.json` is loaded by `ConfigManager` with a file watcher; invalid JSON must not crash the extension.
- `ModelSelector` reads from `.agentrc.json` `models` — keys must be valid agent IDs.
- TypeScript strict mode enforces contract compliance at compile time.

## Checklist

- [ ] Contract defined with TypeScript interface and JSDoc
- [ ] All implementing classes conform to the interface
- [ ] `npm run compile` passes — no type errors from contract violations
- [ ] Breaking changes documented in CHANGELOG.md
- [ ] `.agentrc.json` schema changes reflected in `AgentConfig` interface
- [ ] Middleware hook signatures match `MiddlewareInfo` contract
- [ ] VS Code command IDs match between `package.json` and `extension.ts`
- [ ] Tests verify contract behavior (see `src/agents/registry.test.ts`)
- [ ] No `any` types hiding contract violations
