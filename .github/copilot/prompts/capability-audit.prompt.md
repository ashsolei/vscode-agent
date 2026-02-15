---
mode: "agent"
description: "Audit all AI capabilities vs project usage — identify unused Copilot/Claude/GPT/Gemini features, create adoption plans"
---

# AI Capability Audit

You are an AI capability auditor for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, ModelSelector, ContextProviderRegistry, ToolRegistry).

## Steps

1. **Catalog available AI capabilities**
   - List all VS Code LM API features: model selection, streaming, tool-use, structured output.
   - List Copilot features: chat participants, slash commands, context variables, follow-ups.
   - List model-specific features per provider (GPT, Claude, Gemini): vision, grounding, caching, long context.
   - Create a capability matrix: capability × currently used (yes/no/partial).

2. **Map current usage**
   - Review `src/models/model-selector.ts` — which model features are actively used in routing?
   - Review `src/agents/base-agent.ts` — what VS Code LM API features does `chat()` use?
   - Review `src/tools/index.ts` — which tools are registered and actively invoked?
   - Review `src/context/context-providers.ts` — which context variables are injected?
   - Check `package.json` `chatParticipants` for registered commands and capabilities.

3. **Identify unused capabilities**
   - Compare the capability matrix with actual usage.
   - Prioritize unused capabilities by potential impact on agent quality.
   - Flag capabilities that could replace current workarounds or improve existing agents.
   - Note capabilities that require VS Code version upgrades beyond ^1.93.0.

4. **Create adoption plans**
   - For each high-impact unused capability, draft an adoption plan:
     - Which agents benefit? What changes are needed?
     - Estimated effort (hours) and risk level.
     - Dependencies on other changes or VS Code version.
   - Sequence plans by dependency order and impact.

5. **Validate feasibility**
   ```bash
   npm run compile && npm test
   ```
   - Prototype the top 2-3 capability adoptions.
   - Verify they work within zero-runtime-deps constraint.
   - Test fallback behavior when the capability is unavailable.

6. **Document findings**
   - Update `CAPABILITY-REGISTRY.md` with the full audit results.
   - Add adoption plan summaries to `CHANGELOG.md` or a new tracking document.
   - Update `.agentrc.json` documentation if new config fields are proposed.

## Quality Checklist
- [ ] Capability matrix covers Copilot, GPT, Claude, and Gemini features
- [ ] Current usage mapped across ModelSelector, BaseAgent, ToolRegistry, ContextProviders
- [ ] At least 5 unused capabilities identified and prioritized
- [ ] Top 3 capabilities have concrete adoption plans with effort estimates
- [ ] Zero-runtime-deps constraint verified for all proposed adoptions
- [ ] CAPABILITY-REGISTRY.md updated with audit results

## Pitfalls to Avoid
- Listing capabilities without checking VS Code LM API compatibility.
- Proposing adoptions that require runtime npm dependencies.
- Auditing only model features while ignoring Copilot platform features (context vars, follow-ups).
- Not verifying that proposed capabilities work with the current VS Code minimum version (^1.93.0).
- Creating adoption plans without effort estimates — they won't be prioritized.
