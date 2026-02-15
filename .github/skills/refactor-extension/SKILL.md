---
name: "Refactor Extension"
description: "Refactor the VS Code Agent extension — decompose extension.ts, extract modules, reduce duplication, and improve architecture"
argument-hint: "What to refactor? e.g. 'extract handler logic from extension.ts' or 'consolidate error handling'"
---

# Refactor Extension Skill

Perform targeted refactoring of the VS Code Agent extension codebase.

## Top Refactoring Targets

### 1. `src/extension.ts` — The Registration Monolith

The `activate()` function is the largest single function. It:
- Creates SharedState, MiddlewarePipeline, ResponseCache, AgentMemory, GuardRails
- Registers 30+ agents individually
- Registers 30+ VS Code commands
- Sets up ContextProviderRegistry
- Creates ModelSelector
- Configures event listeners
- Sets up the chat participant handler

**Recommended decomposition:**
```
src/
  extension.ts            → <50 lines: just calls setup functions
  setup/
    register-agents.ts    → all agent imports and registration
    register-commands.ts  → all VS Code command registrations
    create-handler.ts     → the chat participant handler function
    create-services.ts    → SharedState, Cache, Memory, etc.
```

### 2. Agent Prompt Patterns

Many agents duplicate the same prompt construction pattern:
```typescript
const messages = [
    vscode.LanguageModelChatMessage.User(
        `You are a ${role}.\n\n${context}\n\nUser: ${prompt}`
    )
];
const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
const response = await model.sendRequest(messages, {}, token);
for await (const fragment of response.text) { stream.markdown(fragment); }
```

**Extract to BaseAgent utility:**
```typescript
// In BaseAgent:
protected async streamModelResponse(
    systemPrompt: string,
    ctx: AgentContext,
    options?: { model?: string }
): Promise<AgentResult> {
    // All the boilerplate in one place
}
```

### 3. Error Handling Consolidation

Multiple modules implement their own try/catch patterns. Standardize to:
```typescript
// src/utils/safe-execute.ts
export async function safeExecute<T>(
    fn: () => Promise<T>,
    fallback: T,
    label?: string
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        console.error(`[${label}]`, error);
        return fallback;
    }
}
```

### 4. Index File Barrel Exports

Currently each module has `index.ts` that re-exports. Ensure consistency:
```typescript
// src/<module>/index.ts
export { ClassName } from './class-name';
export type { InterfaceName } from './class-name';
```

## Refactoring Process

1. **Identify** the code smell or duplication
2. **Write tests** for the current behavior (if not covered)
3. **Extract** to new module/function
4. **Update imports** across all consumers
5. **Run** `npm run compile && npm run lint && npm test`
6. **Verify** no regressions

## Safe Refactoring Rules

- Never change public interfaces without updating all consumers
- Keep agent IDs stable — they're referenced in `package.json` and `.agentrc.json`
- Maintain barrel exports in `index.ts` files
- Test before AND after refactoring
- One refactoring per commit for easy rollback
- Use TypeScript's strict mode as a safety net — if it compiles, the contracts hold

## Code Smells to Watch For

| Smell | Location | Suggestion |
|---|---|---|
| God function | `activate()` in extension.ts | Split into setup modules |
| Copy-paste | Agent prompt patterns | Extract to BaseAgent helper |
| Long parameter list | `handler(request, ctx, stream, token)` | Use AgentContext object |
| Feature envy | Agents accessing SharedState internals | Add SharedState methods |
| Primitive obsession | String-based agent IDs everywhere | Consider enum or const |
