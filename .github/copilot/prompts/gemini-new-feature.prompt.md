---
mode: "agent"
description: "Assess a new Gemini feature (multimodal, grounding, context), create integration, update ModelSelector routing"
---

# Adopt a New Gemini Feature

You are a Gemini-integration specialist for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, zero runtime deps, ModelSelector, MiddlewarePipeline).

## Steps

1. **Assess the Gemini capability**
   - Classify the feature: multimodal (vision/audio), grounding (search/citations), long context window, code execution, or structured output.
   - Confirm accessibility through VS Code LM API — no `@google/generative-ai` SDK (zero runtime deps).
   - Read `src/models/model-selector.ts` to understand current Gemini routing.

2. **Evaluate multimodal and context advantages**
   - If long-context: identify agents that send large workspace context (e.g., `architect`, `fullstack`, `review`).
   - If grounding: evaluate for `docs`, `explain`, `dependency` agents that benefit from citations.
   - If multimodal: assess `a11y`, `component`, `debug` agents for image/screenshot input.

3. **Create Gemini-optimized integration**
   - Update agent prompts in `src/prompts/system-prompts.ts` to leverage Gemini strengths.
   - If context window is larger, adjust `ContextProviderRegistry` in `src/context/context-providers.ts` to send more context for Gemini-routed agents.
   - Keep Swedish for user-facing strings, English for identifiers.

4. **Update ModelSelector routing**
   - Edit `src/models/model-selector.ts` to route suitable agents to Gemini.
   - Add routing rules in `.agentrc.json` `models{}` (e.g., route `architect` to Gemini for large-context tasks).
   - Implement graceful fallback if Gemini feature is unavailable.

5. **Test and benchmark**
   - Design test prompts that specifically exercise the Gemini capability.
   - Compare quality and latency against current model assignments.
   ```bash
   npm run compile && npm test
   ```
   - Write Vitest tests mocking Gemini-specific API responses.

6. **Document and ship**
   - Update `CAPABILITY-REGISTRY.md` with the new Gemini capability.
   - Update `CHANGELOG.md` and `.agentrc.json` docs.
   - Record benchmark results in dashboard/telemetry.

## Quality Checklist
- [ ] Zero new runtime dependencies — VS Code LM API only
- [ ] Graceful fallback when Gemini feature is unavailable
- [ ] Context size adjustments scoped to Gemini-routed agents only
- [ ] Benchmarked against at least 2 other model options
- [ ] CAPABILITY-REGISTRY.md and `.agentrc.json` updated

## Pitfalls to Avoid
- Installing `@google/generative-ai` or any Gemini SDK — use VS Code LM API.
- Sending oversized context to non-Gemini models after increasing context limits.
- Assuming multimodal features work identically across all Gemini model versions.
- Not testing fallback when grounding/search results are empty or unavailable.
- Coupling Gemini-specific prompt logic tightly to agent code — keep it in `system-prompts.ts`.
