---
name: "Multi-Provider Fallback"
description: "Manage fallback chains across AI providers: health checking, automatic failover, cost-based routing, quality thresholds via ModelSelector"
argument-hint: "Provider or capability"
---

# Multi-Provider Fallback

Configure and manage fallback chains across multiple AI providers for the VS Code Agent extension. Ensures resilience via health checking, automatic failover, cost-aware routing, and quality thresholds — all orchestrated through `ModelSelector` (`src/models/model-selector.ts`).

## Workflow

1. **Inventory** available providers — Copilot, Claude, GPT, Gemini, local models.
2. **Define** fallback chains — primary → secondary → tertiary per agent or task type.
3. **Implement** health checks — probe each provider endpoint before routing.
4. **Set** quality thresholds — minimum acceptable response quality per task category.
5. **Configure** cost constraints — budget limits, prefer cheaper models for simple tasks.
6. **Wire** into `ModelSelector` — update `.agentrc.json` `models` config with fallback order.
7. **Test** failover — simulate provider outages and verify automatic switchover.
8. **Monitor** — track failover events via `AgentDashboard` (`src/dashboard/agent-dashboard.ts`).

## Templates

### .agentrc.json fallback configuration

```json
{
  "models": {
    "primary": { "provider": "copilot", "model": "gpt-4o" },
    "secondary": { "provider": "claude", "model": "claude-sonnet-4-20250514" },
    "fallback": { "provider": "ollama", "endpoint": "http://localhost:11434", "model": "codellama:13b" }
  },
  "fallbackChains": {
    "code": ["primary", "secondary", "fallback"],
    "explain": ["secondary", "primary"],
    "review": ["primary", "secondary"]
  }
}
```

### Health check middleware hook

```typescript
// In src/middleware/middleware.ts — MiddlewarePipeline before-hook
const healthCheck: MiddlewareHook = {
    name: 'provider-health-check',
    phase: 'before',
    handler: async (ctx) => {
        const provider = ModelSelector.getProviderForAgent(ctx.agentName);
        if (!await provider.isHealthy()) {
            const fallback = ModelSelector.getFallback(ctx.agentName);
            ctx.metadata.routedProvider = fallback;
        }
    }
};
```

### Failover test scenario

```bash
# 1. Compile and run tests
npm run compile && npm test

# 2. Simulate primary outage — stop local endpoint
# 3. Verify agent still responds via fallback
# 4. Check dashboard for failover event logged
```

## Rules

- `ModelSelector` (`src/models/model-selector.ts`) owns all provider routing — never bypass it.
- Fallback chains are defined per-agent in `.agentrc.json` — loaded by `ConfigManager` (`src/config/config-manager.ts`) with file watcher.
- Health checks run in `MiddlewarePipeline` (`src/middleware/middleware.ts`) before-hooks — isolated with try/catch.
- Failed health checks must log to telemetry (`src/telemetry/`) and `AgentDashboard`.
- Cost-based routing prefers cheaper providers for simple tasks (explain, status) and reserves premium for complex tasks (architect, review).
- Quality thresholds are optional — when set, responses below threshold trigger re-query on next provider.
- Smart routing (`AgentRegistry.smartRoute()` in `src/agents/index.ts`) falls back to `code` agent if LLM routing fails — provider fallback is orthogonal.
- Rate limiting (`vscodeAgent.rateLimitPerMinute`, default 30) applies per-provider.
- Zero runtime dependencies — health check uses VS Code's built-in fetch or `vscode.env`.
- All failover logic must be testable with Vitest mocks.

## Checklist

- [ ] Provider inventory documented — endpoints, capabilities, cost tiers
- [ ] Fallback chains defined in `.agentrc.json` for each agent
- [ ] Health check middleware added to `MiddlewarePipeline`
- [ ] Failover logging wired to `AgentDashboard` and telemetry
- [ ] Cost constraints configured — budget per provider per time window
- [ ] Quality thresholds set for critical agents (review, security)
- [ ] Failover tested — primary down → secondary responds
- [ ] Rate limits respected per-provider
- [ ] `npm run compile && npm test` passes
- [ ] No runtime dependencies introduced
