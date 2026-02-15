---
name: "Performance Profile"
description: "Profile and optimize extension performance — activation time, middleware overhead, cache efficiency, memory usage, and LLM latency"
argument-hint: "What to profile? e.g. 'activation time' or 'cache hit rate' or 'middleware overhead'"
---

# Performance Profile Skill

Profile and optimize the VS Code Agent extension performance.

## Performance Metrics

### 1. Activation Time
- **Target**: < 200ms for `activate()` to complete
- **Bottlenecks**: Agent imports (30+), command registrations (30+), file watchers
- **Measurement**:
  ```typescript
  // In activate():
  const start = performance.now();
  // ... initialization ...
  console.log(`[Agent] Activation: ${performance.now() - start}ms`);
  ```
- **Optimization**: Lazy-load agents, defer non-critical registrations

### 2. Agent Response Latency
- **Target**: First token < 2s for non-autonomous agents
- **Components**: Routing (< 5ms) + Cache check (< 1ms) + Middleware (< 10ms) + LLM call
- **Measurement**: `TimingMiddleware` logs execution time per agent
- **Optimization**: Cache frequently asked queries, optimize prompts

### 3. Cache Efficiency
- **Metrics**: Hit rate, eviction rate, memory usage
- **Measurement**:
  ```typescript
  // ResponseCache tracks:
  cache.stats()  // { hits, misses, evictions, size, hitRate }
  ```
- **Optimization**:
  - Increase cache size for high-traffic agents
  - Tune TTL based on content freshness needs
  - Use prompt normalization for better cache key matching

### 4. Middleware Overhead
- **Target**: < 10ms total for all hooks per request
- **Measurement**: TimingMiddleware measures per-hook latency
- **Optimization**:
  - Keep hooks synchronous when possible
  - Avoid I/O in before/after hooks
  - Use debouncing for rate-limit checks

### 5. Memory Usage
- **Concerns**: Agent instances (30+), cache entries, memory storage, conversation history
- **Measurement**:
  ```typescript
  const used = process.memoryUsage();
  console.log(`Heap: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
  ```
- **Optimization**:
  - LRU eviction in ResponseCache
  - Prune old entries in AgentMemory
  - Limit conversation history depth
  - Use WeakRef for optional caches

### 6. Context Provider Performance
- **Target**: < 100ms for all providers combined
- **Measurement**: Time each provider individually
- **Bottlenecks**:
  - Git diff: expensive on large repos (> 1000 changed files)
  - Diagnostics: depends on language server speed
  - Dependencies: reading and parsing package.json
- **Optimization**: Cache provider results with short TTL, skip inactive providers

## Profiling Tools

### VS Code Built-in
```
Developer: Show Running Extensions    → see activation time + CPU%
Developer: Start Extension Host Profile → CPU profiling
Developer: Open Process Explorer       → memory per process
```

### Node.js Profiling
```bash
# CPU profile
code --extensionDevelopmentPath=. --inspect-extensions=9229
# Then connect Chrome DevTools to chrome://inspect

# Memory snapshot
process.memoryUsage()
```

### Custom Timing
```typescript
// Quick timing wrapper
function timed<T>(label: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    console.log(`[Perf] ${label}: ${(performance.now() - start).toFixed(2)}ms`);
    return result;
}

// Async version
async function timedAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    console.log(`[Perf] ${label}: ${(performance.now() - start).toFixed(2)}ms`);
    return result;
}
```

## Performance Budget

| Metric | Budget | Current |
|---|---|---|
| Activation | < 200ms | Measure |
| First token | < 2s | LLM-dependent |
| Cache lookup | < 1ms | ~0.1ms |
| Middleware total | < 10ms | Measure |
| Memory baseline | < 50MB | Measure |
| Context providers | < 100ms | Measure |

## Optimization Strategies

1. **Lazy initialization**: Don't create objects until needed
2. **Caching**: Use ResponseCache for repeated queries
3. **Debouncing**: Rate-limit expensive operations
4. **Streaming**: Start showing results before full completion
5. **Parallel execution**: Use `Promise.all` for independent operations
6. **Early termination**: Check `token.isCancellationRequested` frequently
