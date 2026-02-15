---
mode: "agent"
description: "Evaluate a new AI model — benchmark on agent prompts, compare with current models, test via ModelSelector, update .agentrc.json routing"
---

# Evaluate a New AI Model

You are a model evaluation specialist for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, ModelSelector, ResponseCache, MiddlewarePipeline).

## Steps

1. **Profile the new model**
   - Document: model name, provider, context window, strengths (code, reasoning, speed), pricing tier.
   - Confirm it is accessible through VS Code LM API — no new runtime dependencies allowed.
   - Check if the model supports features used by agents: streaming, tool-use, structured output.

2. **Select evaluation agents**
   - Pick 5-8 agents spanning different categories:
     - Code generation: `code`, `component`, `scaffold`
     - Analysis: `review`, `security`, `perf`
     - Documentation: `docgen`, `explain`
     - Operations: `debug`, `cli`, `devops`
   - Extract their prompts from `src/agents/<name>-agent.ts` and `src/prompts/system-prompts.ts`.

3. **Run comparative evaluation**
   - For each selected agent, prepare 3 representative inputs.
   - Run inputs through both the current model and the new model.
   - Capture: response quality (1-5), latency (ms), token usage, Swedish text quality.
   - Disable `ResponseCache` to ensure fresh responses.

4. **Analyze results**
   - Score improvements: where does the new model win? Where does it lose?
   - Calculate cost impact: tokens × price for current vs new model.
   - Identify agents that should switch vs agents that should stay on current model.

5. **Configure ModelSelector**
   - Update `src/models/model-selector.ts` to add the new model as a routing option.
   - Set routing rules in `.agentrc.json` `models{}` for specific agents.
   - Implement fallback: if the new model is unavailable, revert to previous model.
   ```bash
   npm run compile && npm test
   ```

6. **Document and verify**
   - Record evaluation results in `CAPABILITY-REGISTRY.md`.
   - Update `CHANGELOG.md` with the new model integration.
   - Run full test suite to confirm no regressions.

## Quality Checklist
- [ ] Model accessible via VS Code LM API — no new runtime deps
- [ ] Evaluated on 5+ agents with 3+ inputs each
- [ ] Cost comparison documented (tokens × price)
- [ ] ModelSelector routing updated with fallback
- [ ] `.agentrc.json` `models{}` section updated
- [ ] Swedish UI string quality verified in responses

## Pitfalls to Avoid
- Adding a model-specific SDK as a runtime dependency.
- Evaluating only on easy prompts — include edge cases and large-context scenarios.
- Switching all agents to the new model without per-agent evaluation.
- Not testing the fallback path when the new model is rate-limited or down.
- Ignoring token pricing differences — a faster model may cost more per token.
