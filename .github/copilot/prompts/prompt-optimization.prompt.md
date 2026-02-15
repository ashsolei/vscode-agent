---
mode: "agent"
description: "Systematically improve an agent's prompt — analyze failures, test variants with different models, measure improvement, deploy best version"
---

# Prompt Optimization

You are a prompt engineering specialist for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, ModelSelector, system-prompts.ts).

## Steps

1. **Select the target agent and baseline**
   - Choose the agent to optimize from `src/agents/<name>-agent.ts`.
   - Extract its current prompt (inline `PROMPT` constant or from `src/prompts/system-prompts.ts`).
   - Collect 5-10 failure cases where the agent produced poor output.
   - Document the failure patterns: wrong language, incomplete code, missed context, hallucination.

2. **Analyze prompt weaknesses**
   - Check if the prompt clearly defines the persona and task scope.
   - Verify it specifies Swedish for user-facing text and English for code.
   - Look for missing constraints: output format, error handling, follow-up generation.
   - Compare against high-performing agents' prompts for structural patterns.

3. **Design prompt variants**
   - Create 3-5 variants addressing identified weaknesses:
     - Variant A: Stronger persona and constraints.
     - Variant B: Few-shot examples added.
     - Variant C: Chain-of-thought reasoning instructions.
     - Variant D: Structured output format specification.
   - Keep variants in a test file for A/B comparison.

4. **Test variants across models**
   - Run each variant through `ModelSelector`'s available models.
   - Use the 5-10 failure cases as test inputs.
   - Score each variant × model combination on: correctness, completeness, format adherence.
   - Disable `ResponseCache` during testing.
   ```bash
   npm run compile && npm test
   ```

5. **Deploy the winning prompt**
   - Update the agent's prompt in `src/agents/<name>-agent.ts` or `src/prompts/system-prompts.ts`.
   - Write a Vitest test in `src/agents/<name>.test.ts` that validates the improved behavior.
   - Run full test suite to check for regressions.
   ```bash
   npm run compile && npm test
   ```

6. **Document the optimization**
   - Record before/after scores in `CHANGELOG.md`.
   - Note which models the prompt was optimized for.
   - Update `CAPABILITY-REGISTRY.md` if the agent's capabilities changed.

## Quality Checklist
- [ ] At least 5 failure cases analyzed before optimization
- [ ] 3+ prompt variants tested against failure cases
- [ ] Variants tested on at least 2 different models
- [ ] Winning prompt deployed with accompanying test
- [ ] No regression in other agents' test suites
- [ ] Swedish UI strings and English code identifiers preserved

## Pitfalls to Avoid
- Optimizing for one model and breaking compatibility with others.
- Adding so many constraints that the prompt exceeds context window limits.
- Using few-shot examples that are too specific, reducing generalization.
- Not testing the prompt with `MiddlewarePipeline` hooks active — they modify context.
- Skipping the baseline measurement — improvements can't be quantified without it.
