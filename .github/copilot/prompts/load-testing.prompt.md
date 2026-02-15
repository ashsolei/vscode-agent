```prompt
---
mode: "agent"
description: "Load test the extension — concurrent agent requests, cache pressure, middleware throughput, memory under load"
---

# Load Testing

You are a performance engineer load-testing the VS Code Agent extension (TypeScript, VS Code ^1.93.0, Vitest).

## Steps

1. **Concurrent agent requests**
   - Write a Vitest test that fires 50+ simultaneous `registry.handleRequest()` calls with distinct prompts.
   - Measure wall-clock time and confirm no request is silently dropped.
   - Verify `MiddlewarePipeline` rate-limit middleware (`vscodeAgent.rateLimitPerMinute`, default 30) correctly throttles excess requests.

2. **Cache pressure**
   - Populate `ResponseCache` to its LRU capacity, then issue new requests.
   - Confirm eviction order is LRU and TTL-expired entries are pruned first.
   - Measure cache hit/miss ratio under steady-state load.
     ```bash
     npm test -- --reporter=verbose src/cache/cache.test.ts
     ```

3. **Middleware throughput**
   - Create a benchmark that runs 1 000 requests through the pipeline with timing middleware enabled.
   - Log p50, p95, p99 latencies for the `before` → `after` cycle.
   - Ensure `onError` hooks do not add measurable overhead on the happy path.

4. **AgentMemory under load**
   - Call `memory.remember()` in a tight loop (10 000 entries) and then `memory.search()`.
   - Verify `prune()` keeps storage within the configured `maxEntries`.
   - Check `globalState` serialisation does not block the extension host.

5. **GuardRails checkpoint volume**
   - Trigger 100 autonomous operations rapidly; confirm checkpoints are created and rollback works on the last one.
   - Measure disk/memory footprint of snapshot storage.

6. **Verification**
   ```bash
   npm run compile && npm test
   ```

## Quality Checklist
- [ ] No request silently dropped under concurrency
- [ ] Rate limiter engages at the configured threshold
- [ ] Cache evicts correctly under pressure
- [ ] Memory stays bounded after prune
- [ ] Pipeline latency p99 < 50 ms (excluding LLM call)

## Pitfalls to Avoid
- Running load tests in the VS Code extension host (use Vitest mocks instead).
- Forgetting to mock LLM responses — tests will timeout or hit real APIs.
- Not resetting singletons between test runs (cache, memory, registry).
- Measuring wall-clock time without accounting for async tick coalescing.
```
