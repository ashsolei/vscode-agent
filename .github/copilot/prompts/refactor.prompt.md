---
mode: "agent"
description: "Refactor a module — extract shared code, improve SOLID compliance, reduce duplication in agents and subsystems"
---

# Refactor Module

Systematically refactor a module in the VS Code Agent extension.

## Process

1. **Analyze**: Read the target module and all its usages
2. **Identify**: List code smells — duplication, large functions, tight coupling, god objects
3. **Plan**: Design the refactored structure with clear interfaces
4. **Extract**: Move shared code to utilities or base classes
5. **Update**: Fix all imports and references
6. **Test**: Verify all existing tests pass, add tests for extracted code
7. **Verify**: `npm run compile && npm test`

## Common Refactoring Targets

### Autonomous Agent Pattern
30+ agents duplicate this pattern:
```typescript
const executor = new AutonomousExecutor(ctx.stream);
this.progress(ctx, '...');
let projectContext = '';
// ... gather context ...
const messages = [User(PROMPT), User(context + prompt)];
const response = await model.sendRequest(messages, {}, token);
let fullResponse = '';
for await (const fragment of response.text) { fullResponse += fragment; }
const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)```/);
// ... parse and apply ...
```
Extract to shared utility or `AutonomousAgentBase`.

### Extension.ts Size (900+ lines)
Extract to separate files:
- Command registration → `src/commands/`
- Chat handler → `src/handler/`
- Subsystem initialization → `src/bootstrap/`

## Rules

- Keep agent IDs stable — they are the public API
- Keep `BaseAgent` interface unchanged
- Maintain backward compatibility with `.agentrc.json` schema
- Export extracted code via barrel `index.ts` files
- Don't break middleware or guardrails integration
