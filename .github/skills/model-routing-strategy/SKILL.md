---
name: "Model Routing Strategy"
description: "Route tasks to optimal AI model: task classification, context size analysis, cost/quality trade-offs, fallback chains. Uses ModelSelector + .agentrc.json models config."
argument-hint: "Task type or agent"
---

# Model Routing Strategy

Route agent tasks to the optimal AI model based on task complexity, context size, cost, and quality requirements. Orchestrated through `ModelSelector` (`src/models/model-selector.ts`) and configured via `.agentrc.json`.

## Workflow

1. **Classify** the task — simple (explain, status), medium (code, test), complex (architect, security, review).
2. **Analyze** context size — small (<4K tokens), medium (4K-32K), large (32K-200K).
3. **Evaluate** cost/quality trade-offs — budget constraints vs quality requirements.
4. **Select** model — match classification to model capabilities via `ModelSelector`.
5. **Configure** fallback — define secondary model if primary is unavailable.
6. **Validate** — test routing decisions with representative prompts.
7. **Monitor** — track model usage, cost, and quality via `AgentDashboard` (`src/dashboard/agent-dashboard.ts`).

## Templates

### .agentrc.json routing configuration

```json
{
  "models": {
    "fast": { "provider": "copilot", "model": "gpt-4o-mini" },
    "balanced": { "provider": "copilot", "model": "gpt-4o" },
    "premium": { "provider": "claude", "model": "claude-sonnet-4-20250514" },
    "local": { "provider": "ollama", "model": "codellama:13b" }
  },
  "agentModels": {
    "explain": "fast",
    "status": "fast",
    "code": "balanced",
    "test": "balanced",
    "refactor": "balanced",
    "review": "premium",
    "architect": "premium",
    "security": "premium",
    "planner": "premium"
  }
}
```

### Task classification matrix

| Agent       | Complexity | Typical Context | Recommended Tier | Rationale                        |
|-------------|-----------|-----------------|-----------------|----------------------------------|
| explain     | Simple    | <4K             | fast            | Summarization, low stakes        |
| status      | Simple    | <2K             | fast            | System info, no generation       |
| code        | Medium    | 4K-32K          | balanced        | Code generation, moderate stakes |
| test        | Medium    | 4K-16K          | balanced        | Test generation, pattern-based   |
| review      | Complex   | 8K-64K          | premium         | Nuanced analysis, high stakes    |
| architect   | Complex   | 16K-200K        | premium         | System design, multi-file        |
| security    | Complex   | 8K-64K          | premium         | Vulnerability detection          |

### ModelSelector integration

```typescript
// ModelSelector reads .agentrc.json via ConfigManager
const model = modelSelector.getModelForAgent('review');
// Returns: { provider: 'claude', model: 'claude-sonnet-4-20250514' }
```

### Smart routing fallback

```typescript
// AgentRegistry.smartRoute() selects the agent; ModelSelector selects the model
// If selected model unavailable, ModelSelector walks the fallback chain
```

## Rules

- `ModelSelector` is the single owner of model routing — all agents query it, never hardcode models.
- `.agentrc.json` `models` and `agentModels` sections define the routing table — loaded by `ConfigManager` (`src/config/config-manager.ts`).
- Smart routing (`AgentRegistry.smartRoute()`) selects the *agent*; `ModelSelector` selects the *model* — orthogonal concerns.
- Cost tiers: fast < balanced < premium — always use the cheapest tier that meets quality requirements.
- Context size determines minimum context window — never send 64K tokens to a 4K model.
- Fallback chains ensure resilience — see `multi-provider-fallback` skill.
- Rate limiting (`vscodeAgent.rateLimitPerMinute`) applies per-provider via `MiddlewarePipeline`.
- Autonomous agents (`isAutonomous: true`) should prefer premium models — mistakes are costly.
- All routing changes require: `npm run compile && npm test`.
- Monitor routing decisions in `AgentDashboard` to detect misrouting.

## Checklist

- [ ] Task classification defined for all active agents
- [ ] `.agentrc.json` `models` section populated with available models
- [ ] `agentModels` mapping configured per agent
- [ ] Context size analysis done for representative prompts per agent
- [ ] Cost/quality trade-offs documented
- [ ] Fallback chains configured for each model tier
- [ ] `ModelSelector` tested with mock configs
- [ ] Rate limits set per provider
- [ ] `AgentDashboard` tracking model usage
- [ ] `npm run compile && npm test` passes
