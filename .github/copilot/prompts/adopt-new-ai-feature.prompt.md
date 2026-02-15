```prompt
---
mode: "agent"
description: "Evaluate and adopt a new AI feature — assess relevance, create integration plan, implement agent/skill/prompt, test, update CAPABILITY-REGISTRY.md"
---

# Adopt a New AI Feature

You are an AI-integration engineer evaluating a new AI capability for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents, ModelSelector, MiddlewarePipeline).

## Steps

1. **Inventory the new feature**
   - What does it do? (e.g., new model endpoint, tool-use, structured output, vision, audio)
   - Which API surface exposes it? (VS Code LM API, direct model API, third-party SDK)
   - Does it require a runtime dependency? If yes, STOP — zero runtime deps policy.

2. **Assess relevance to existing agents**
   - Which of the 30+ agents would benefit? Map the feature to agent capabilities.
   - Does it enable a new agent type, or enhance an existing one?
   - Check `ModelSelector` in `src/models/model-selector.ts` — does routing need updating?

3. **Create an integration plan**
   - Draft the approach: new agent, new middleware hook, new tool, or prompt-only change.
   - Identify affected files: `src/agents/`, `src/models/`, `src/middleware/`, `src/tools/`.
   - Estimate effort and risk.

4. **Implement**
   - If new agent: follow `new-agent.prompt.md` workflow.
   - If new middleware: follow `new-middleware.prompt.md` workflow.
   - If prompt-only: update `src/prompts/system-prompts.ts` or agent-level prompts.
   - If model routing: update `ModelSelector` and `.agentrc.json` `models{}` schema.

5. **Test**
   ```bash
   npm run compile && npm test
   ```
   - Write tests that mock the new feature's API responses.
   - Add an integration test if the feature involves multi-agent coordination.

6. **Document**
   - Update `CAPABILITY-REGISTRY.md` with the new capability.
   - Add entry to CHANGELOG.md.
   - Update `.agentrc.json` documentation if new config fields were added.

## Quality Checklist
- [ ] Zero new runtime dependencies
- [ ] Feature gracefully degrades if the AI capability is unavailable
- [ ] ModelSelector routes to appropriate model for the feature
- [ ] Tests cover both success and fallback paths
- [ ] CAPABILITY-REGISTRY.md updated

## Pitfalls to Avoid
- Adopting a feature that requires a runtime npm package.
- Hardcoding a model name — use `ModelSelector` for flexibility.
- Not testing the fallback path when the new capability returns an error.
- Updating `ModelSelector` without updating `.agentrc.json` `models{}` documentation.
```
