---
name: "Agent Metrics Dashboard"
description: "Track agent system health: KPIs (success rate, error rate, latency), AgentDashboard WebView, TimingMiddleware data, cost tracking"
argument-hint: "Metric type or 'all'"
---

# Agent Metrics Dashboard

Track and visualize agent system health through key performance indicators. Uses `AgentDashboard` WebView, `TimingMiddleware`, `UsageTrackingMiddleware`, and telemetry — all within the zero-dependency constraint.

## Workflow

1. **Define** KPIs for the target metric area (latency, success rate, cost, usage).
2. **Instrument** data collection via middleware hooks in `MiddlewarePipeline`.
3. **Aggregate** metrics in-memory for the dashboard.
4. **Display** in the `AgentDashboard` WebView panel.
5. **Test** — verify middleware data collection with Vitest.
6. **Validate** — `npm run compile && npm test`.

## Key Performance Indicators

| KPI | Source | Calculation |
|-----|--------|-------------|
| Request latency (p50/p95/p99) | TimingMiddleware `before`/`after` | Sorted durations, percentile index |
| Success rate | Agent `handle()` return vs throw | `successes / totalRequests * 100` |
| Error rate | Middleware `onError` hook count | `errors / totalRequests * 100` |
| Cache hit rate | `ResponseCache` hits vs misses | `hits / (hits + misses) * 100` |
| Requests per agent | UsageTrackingMiddleware | Counter per `agentId` |
| Token usage estimate | Response length / 4 heuristic | Sum per agent per session |

## Templates

### Metrics collector

```typescript
interface AgentMetrics {
    agentId: string;
    totalRequests: number;
    successes: number;
    errors: number;
    latencies: number[];  // ms values
    lastRequestAt: number;
}

class MetricsCollector {
    private metrics = new Map<string, AgentMetrics>();

    record(agentId: string, latencyMs: number, success: boolean): void {
        const m = this.metrics.get(agentId) ?? {
            agentId, totalRequests: 0, successes: 0, errors: 0, latencies: [], lastRequestAt: 0
        };
        m.totalRequests++;
        m.latencies.push(latencyMs);
        success ? m.successes++ : m.errors++;
        this.metrics.set(agentId, m);
    }
}
```

### Feeding metrics from TimingMiddleware

```typescript
const metricsMiddleware: Middleware = {
    name: 'metrics',
    priority: 5,
    before: async (ctx) => {
        ctx.metadata = ctx.metadata || {};
        ctx.metadata._metricsStart = Date.now();
    },
    after: async (ctx) => {
        const latency = Date.now() - (ctx.metadata?._metricsStart ?? 0);
        collector.record(ctx.agentId, latency, true);
    },
    onError: async (ctx) => {
        const latency = Date.now() - (ctx.metadata?._metricsStart ?? 0);
        collector.record(ctx.agentId, latency, false);
    }
};
```

## Rules

- **Zero runtime dependencies** — all metrics, aggregation, and rendering use only VS Code API and Node.js built-ins.
- `AgentDashboard` is a WebView panel at `src/dashboard/agent-dashboard.ts` — data is passed via `postMessage`.
- Middleware priority determines execution order: lower number = runs earlier.
- Latency arrays are kept in-memory — prune old entries to avoid memory leaks.
- Token usage is estimated via `length / 4` heuristic — no external tokenizer.
- Middleware tests: `src/middleware/middleware.test.ts` and `src/middleware/middleware-builtins.test.ts`.
- All metrics reset on extension deactivation.

## Checklist

- [ ] MetricsCollector tracks latency, success, and error counts per agent
- [ ] TimingMiddleware feeds data to MetricsCollector via `before`/`after` hooks
- [ ] Percentile calculation (p50, p95, p99) implemented and tested
- [ ] Cache hit/miss rate tracked in `ResponseCache`
- [ ] AgentDashboard WebView renders metrics table
- [ ] Memory usage bounded — old latency entries pruned
- [ ] `npm run compile && npm test` passes with metrics tests
