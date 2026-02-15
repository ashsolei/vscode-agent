---
mode: "agent"
description: "Optimize extension performance — activation time, middleware overhead, cache efficiency, memory usage, and streaming latency"
---

# Performance Optimization

Profile and optimize the VS Code Agent extension.

## Focus Areas

### 1. Activation Time
- Read `src/extension.ts` `activate()` function
- Identify synchronous initialization that could be deferred
- Check for unnecessary file reads at startup
- Consider lazy-loading subsystems (dashboards, marketplace, etc.)

### 2. Request Latency
```
Measure each stage:
resolve agent     → target: < 1ms
check cache       → target: < 5ms
guardrails        → target: < 10ms
gather context    → target: < 200ms
middleware before  → target: < 5ms
agent.handle()    → varies (LLM bound)
middleware after   → target: < 5ms
cache store       → target: < 10ms
```

### 3. Memory Usage
- Check globalState sizes (cache, memory, telemetry)
- Verify LRU cache properly evicts old entries
- Check for memory leaks in event listeners and watchers
- Verify disposed subscriptions are removed

### 4. Cache Efficiency
- Check hit rate via health check command
- Verify TTL settings match usage patterns
- Check if cache keys are too specific (low hit rate)
- Verify invalidation works correctly

## Profiling

```bash
# Run with timing logs
# Set vscodeAgent.telemetry.enabled = true
# Check Output panel → "VS Code Agent" for timing data

npm run compile
# Launch extension in debug mode (F5)
# Watch the timing middleware logs
```

## Anti-Patterns

1. `await` in loops instead of `Promise.all()` for independent operations
2. Reading same file multiple times in one request
3. `AgentMemory.search()` scanning all entries linearly
4. Unbounded arrays without cleanup (rate-limit timestamps)
5. Large strings in globalState (256KB limit per key)
