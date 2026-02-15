---
mode: "agent"
description: "Optimize AI costs — analyze ResponseCache hit rates, model routing efficiency, context size, identify cheaper model opportunities"
---

# AI Cost Optimization

You are a cost-optimization engineer for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents, ModelSelector, ResponseCache, MiddlewarePipeline, ContextProviderRegistry).

## Steps

1. **Audit current model usage**
   - Review `src/models/model-selector.ts` to map which agents route to which models.
   - Check `.agentrc.json` `models{}` for custom routing overrides.
   - Identify the most expensive model assignments (e.g., GPT-4o for simple tasks).
   - List agents by expected call frequency using `src/telemetry/` and `src/dashboard/agent-dashboard.ts`.

2. **Analyze ResponseCache effectiveness**
   - Review `src/cache/response-cache.ts` — check LRU size and TTL configuration.
   - Identify agents with low cache hit rates that could benefit from longer TTL.
   - Check if cache keys are too specific (e.g., including timestamps), reducing hits.
   - Review `src/cache/cache.test.ts` for existing cache behavior tests.

3. **Optimize context size**
   - Audit `src/context/context-providers.ts` — measure context injected per agent.
   - Identify agents receiving unnecessary context (e.g., full git diff for `explain` agent).
   - Reduce context to minimum needed: trim diagnostics, limit diff size, scope dependencies.
   - Fewer input tokens = lower cost per request.

4. **Identify cheaper model opportunities**
   - For each agent, assess if a smaller/cheaper model achieves acceptable quality.
   - Candidates for downgrade: `explain`, `docgen`, `translate`, `i18n`, `status`.
   - Keep premium models for: `security`, `architect`, `review`, `code`.
   - Update `ModelSelector` routing and `.agentrc.json` accordingly.

5. **Implement and measure savings**
   ```bash
   npm run compile && npm test
   ```
   - Add token-counting middleware in `src/middleware/middleware.ts` if not present.
   - Track before/after token usage per agent via `MiddlewarePipeline`.
   - Estimate cost reduction using model pricing tables.

6. **Document cost profile**
   - Create a cost summary in `CAPABILITY-REGISTRY.md` or `CHANGELOG.md`.
   - Document routing decisions and their cost/quality trade-offs.
   - Set up alerts for cost anomalies via middleware hooks.

## Quality Checklist
- [ ] ResponseCache TTL tuned per agent usage pattern
- [ ] Context injection scoped to minimum necessary per agent
- [ ] At least 3 agents evaluated for cheaper model routing
- [ ] Token-counting middleware active and logging
- [ ] Quality verified after model downgrades via test suite
- [ ] Cost trade-offs documented

## Pitfalls to Avoid
- Downgrading model for `security` or `review` agents — quality is critical there.
- Setting ResponseCache TTL too high — stale responses degrade user experience.
- Reducing context so aggressively that agent quality drops below acceptance threshold.
- Not measuring baseline costs before optimizing — improvements can't be quantified.
- Forgetting that `MiddlewarePipeline` hooks add latency — keep counting lightweight.
