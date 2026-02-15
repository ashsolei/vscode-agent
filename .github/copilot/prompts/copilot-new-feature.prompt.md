```prompt
---
mode: "agent"
description: "When a new Copilot feature arrives — inventory it, assess impact on extension, create/update agents and prompts, document usage patterns"
---

# New Copilot Feature Adoption

You are a Copilot-platform specialist integrating a new GitHub Copilot feature into the VS Code Agent extension (TypeScript, VS Code ^1.93.0, Chat Participant API, 30+ agents).

## Steps

1. **Inventory the new feature**
   - Read the Copilot / VS Code release notes for the new capability.
   - Identify the API surface: `vscode.lm.*`, `vscode.chat.*`, `ChatParticipant` changes, new `ChatResponseStream` methods.
   - Check minimum VS Code version — does it still fit `^1.93.0` or do we need to bump?

2. **Assess impact on the extension**
   - Does the feature change `ChatRequest`, `ChatContext`, or `ChatResponseStream` interfaces?
   - Does it introduce new participant capabilities (tool calling, references, annotations)?
   - Review `src/extension.ts` handler — does the request flow need updating?
   - Check if `MiddlewarePipeline` hooks need new data passed through `AgentContext`.

3. **Plan changes**
   - Map the feature to agents that benefit most (e.g., code completion → `CodeAgent`, references → `DocsAgent`).
   - Decide: new agent, enhanced existing agent, new middleware, or prompt update.
   - Update `AgentContext` interface in `src/agents/base-agent.ts` if new data is available.

4. **Implement**
   - Update `src/extension.ts` to capture new request properties.
   - Modify target agents to leverage the feature in their `handle()` methods.
   - If the feature provides new `stream.*` methods, use them in agent responses.
   - Update `package.json` → `chatParticipants` if new capabilities need declaration.

5. **Test and verify**
   ```bash
   npm run compile && npm test
   ```
   - Mock the new API surface in `src/__mocks__/vscode.ts`.
   - Write tests that exercise the new feature path.

6. **Document**
   - Update README.md with the new capability.
   - Add usage patterns to `media/walkthrough/` if user-facing.
   - Update CHANGELOG.md.

## Quality Checklist
- [ ] Minimum VS Code version still met or explicitly bumped
- [ ] `AgentContext` extended without breaking existing agents
- [ ] VS Code mock updated for new API surface
- [ ] Feature degrades gracefully on older VS Code versions
- [ ] All 30+ agents still compile and pass tests

## Pitfalls to Avoid
- Bumping the VS Code engine version without updating `package.json` `engines.vscode`.
- Adding new required fields to `AgentContext` without providing defaults.
- Using a new `stream.*` method without checking it exists (older VS Code).
- Forgetting to update the `vscode.ts` mock — tests will pass vacuously.
```
