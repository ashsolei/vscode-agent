```prompt
---
mode: "agent"
description: "When a new Claude capability arrives — map to project needs, create optimised prompts, update ModelSelector routing, document best practices"
---

# New Claude Capability Adoption

You are an LLM-integration specialist adapting the VS Code Agent extension to leverage a new Claude capability (TypeScript, VS Code ^1.93.0, ModelSelector, 30+ agents).

## Steps

1. **Understand the new capability**
   - Read the Claude release notes / documentation for the new feature.
   - Identify: extended context window, new tool-use patterns, improved structured output, vision, caching, system prompt changes, or new model tier.
   - Determine if it is available via the VS Code LM API or requires direct API access.

2. **Map to project needs**
   - Which agents benefit? Examples:
     - Extended context → `ArchitectAgent`, `FullstackAgent` (large codebases).
     - Better tool use → `AutonomousExecutor`-backed agents.
     - Structured output → `ScaffoldAgent`, `DatabaseAgent` (JSON schemas).
   - Does the capability improve `smartRoute()` accuracy in `AgentRegistry`?

3. **Create optimised prompts**
   - Update system prompts in `src/prompts/system-prompts.ts` to leverage the new capability.
   - Use Claude-specific prompt patterns (e.g., XML tags, prefilled assistant turns) where they improve quality.
   - Keep prompts model-agnostic where possible — `ModelSelector` may route to non-Claude models.
   - A/B test: write both a generic and Claude-optimised variant.

4. **Update ModelSelector routing**
   - Edit `src/models/model-selector.ts` to prefer the Claude model for agents that benefit most.
   - Update `.agentrc.json` `models{}` schema if new model identifiers are added.
   - Ensure fallback: if the Claude model is unavailable, `ModelSelector` picks the next best.

5. **Test**
   ```bash
   npm run compile && npm test
   ```
   - Mock Claude-specific responses in tests.
   - Verify agents work with both Claude-optimised and generic prompts.
   - Test `ModelSelector` fallback path.

6. **Document best practices**
   - Add a section to `docs/` or CAPABILITY-REGISTRY.md describing when to use the new capability.
   - Note any prompt patterns that are Claude-specific vs. model-agnostic.
   - Update CHANGELOG.md.

## Quality Checklist
- [ ] Prompts degrade gracefully when routed to non-Claude models
- [ ] ModelSelector updated with correct model identifiers
- [ ] `.agentrc.json` `models{}` docs updated
- [ ] Tests cover both Claude-optimised and fallback paths
- [ ] No runtime dependencies introduced

## Pitfalls to Avoid
- Hardcoding Claude model IDs in agent files — always go through `ModelSelector`.
- Writing prompts that only work with Claude (breaks model-agnostic routing).
- Assuming the new capability is available on all Claude tiers.
- Not testing the fallback path — if the preferred model is unavailable, the agent must still function.
- Ignoring token-cost implications of extended context usage on every request.
```
