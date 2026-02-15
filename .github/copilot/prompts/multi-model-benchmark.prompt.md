---
mode: "agent"
description: "Benchmark multiple models on project-specific agent tasks — design test prompts, run comparisons, produce model routing recommendations"
---

# Multi-Model Benchmark

You are a model evaluation engineer for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, ModelSelector, ResponseCache, MiddlewarePipeline).

## Steps

1. **Define the benchmark matrix**
   - List models to compare (e.g., GPT-4o, Claude Sonnet, Gemini Pro, local models).
   - List agent categories to test: code generation (`code`, `component`, `fullstack`), analysis (`review`, `security`, `perf`), documentation (`docgen`, `explain`, `docs`), operations (`debug`, `devops`, `cli`).
   - Target 3-5 representative prompts per category.

2. **Design test prompts from real usage**
   - Extract prompts from `src/prompts/system-prompts.ts` and agent-level prompts.
   - Include edge cases: large context, multi-file references, ambiguous instructions.
   - Create a `benchmarks/` directory with prompt fixtures as `.txt` files.
   - Disable `ResponseCache` during benchmarking to get fresh results.

3. **Run benchmarks**
   - For each model × prompt combination, capture: response text, latency (ms), token count, error rate.
   - Use `MiddlewarePipeline` timing middleware from `src/middleware/middleware.ts` to measure latency.
   - Log results to structured JSON in `benchmarks/results/`.
   ```bash
   npm run compile && npm test
   ```

4. **Score and compare**
   - Rate responses on: correctness, completeness, code quality, adherence to Swedish UI strings.
   - Calculate cost-per-quality-point using token counts and model pricing.
   - Identify which model wins per agent category.

5. **Produce routing recommendations**
   - Map each agent to its optimal model based on benchmark scores.
   - Update `src/models/model-selector.ts` with recommended routing.
   - Update `.agentrc.json` `models{}` section with the optimal configuration.
   - Document trade-offs (cost vs quality vs latency) for each routing decision.

6. **Validate and document**
   - Run full test suite with new routing: `npm run compile && npm test`.
   - Update `CAPABILITY-REGISTRY.md` with benchmark findings.
   - Add summary to `CHANGELOG.md`.

## Quality Checklist
- [ ] At least 3 models compared across 4+ agent categories
- [ ] Prompts derived from actual agent use cases, not synthetic
- [ ] Cost-per-quality analysis included in routing recommendations
- [ ] ModelSelector updated with justified routing rules
- [ ] Benchmark results reproducible and stored in `benchmarks/`

## Pitfalls to Avoid
- Running benchmarks with `ResponseCache` enabled — results will be stale.
- Comparing models on synthetic prompts that don't reflect real agent usage.
- Optimizing solely for cost without verifying quality thresholds.
- Not accounting for rate limits when benchmarking cloud models.
- Changing ModelSelector routing without updating `.agentrc.json` documentation.
