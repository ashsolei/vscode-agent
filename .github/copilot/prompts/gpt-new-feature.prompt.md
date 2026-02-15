---
mode: "agent"
description: "Assess a new GPT feature, create optimized prompts, update ModelSelector routing, and benchmark against current approach"
---

# Adopt a New GPT Feature

You are a GPT-integration specialist for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, zero runtime deps, ModelSelector, MiddlewarePipeline).

## Steps

1. **Identify the GPT capability**
   - Name the feature (e.g., function-calling improvements, structured outputs, system prompt caching, vision enhancements).
   - Confirm it is accessible through the VS Code LM API — no direct OpenAI SDK allowed (zero runtime deps).
   - Read `src/models/model-selector.ts` to understand current GPT routing.

2. **Map to existing agents**
   - Review `src/agents/index.ts` registry to find agents that would benefit.
   - Check if any agent prompts in `src/prompts/system-prompts.ts` can leverage the feature.
   - Determine if a new agent is needed or an existing one should be extended.

3. **Create optimized prompts**
   - Draft GPT-tuned prompt variants in `src/prompts/system-prompts.ts`.
   - Use GPT-specific capabilities (e.g., structured JSON mode, tool-use format).
   - Keep prompts in Swedish for user-facing text, English for code identifiers.

4. **Update ModelSelector routing**
   - Edit `src/models/model-selector.ts` to route appropriate agents to the GPT model.
   - Update `.agentrc.json` `models{}` section with the new routing rules.
   - Ensure fallback to the previous model if the feature is unavailable.

5. **Benchmark against current approach**
   - Design 5-10 representative prompts from agent use cases.
   - Run each through both old and new approaches, capture response quality and latency.
   - Log results via `src/telemetry/` and compare in `src/dashboard/agent-dashboard.ts`.
   ```bash
   npm run compile && npm test
   ```

6. **Integrate and verify**
   - Apply the winning prompt/routing configuration.
   - Run the full test suite: `npm run compile && npm test`.
   - Update `CAPABILITY-REGISTRY.md` and `CHANGELOG.md`.

## Quality Checklist
- [ ] Zero new runtime dependencies
- [ ] ModelSelector falls back gracefully if GPT feature is unavailable
- [ ] Prompt variants tested with at least 5 representative inputs
- [ ] `.agentrc.json` `models{}` documentation updated
- [ ] Benchmark results recorded in telemetry or dashboard
- [ ] CAPABILITY-REGISTRY.md updated with new GPT capability

## Pitfalls to Avoid
- Importing the OpenAI SDK directly — use VS Code LM API only.
- Hardcoding `gpt-4o` or any model name — route through `ModelSelector`.
- Skipping fallback testing when the GPT feature returns an error or is rate-limited.
- Optimizing prompts for GPT without verifying they still work on other models.
- Forgetting to update `.agentrc.json` schema when adding new model routing fields.
