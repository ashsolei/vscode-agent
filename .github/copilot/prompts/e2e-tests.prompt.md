````prompt
---
mode: "agent"
description: "Write E2E tests verifying the full agent pipeline — user message → routing → middleware → agent → response"
---

# End-to-End Tests

You are a QA engineer for the VS Code Agent extension (TypeScript, 30+ agents, MiddlewarePipeline, ResponseCache, GuardRails). You will write tests that exercise the full request pipeline from message input to streamed response.

## Workflow

1. **Map the pipeline**: Understand the full flow:
   ```
   User message → handler() → smartRoute() / slash-command
     → ResponseCache check → GuardRails checkpoint (if autonomous)
     → ContextProviderRegistry injects workspaceContext
     → MiddlewarePipeline.execute() (before → agent.handle() → after)
     → stream captured for caching → telemetry/dashboard logged
   ```

2. **Create test fixtures** in `src/test/suite/`:
   - Mock `ChatRequest`, `ChatContext`, `ChatResponseStream`, `CancellationToken`.
   - Use `TestAgent` helper pattern from `registry-extended.test.ts`.
   - Create a minimal `AgentContext` with controlled inputs.

3. **Write E2E test cases**:
   ```typescript
   test('full pipeline: message → routing → middleware → response', async () => {
     // 1. Simulate user message with slash command
     // 2. Verify smartRoute selects correct agent
     // 3. Assert middleware before/after hooks fired
     // 4. Assert agent produced expected stream output
     // 5. Verify response was cached
   });
   ```

4. **Test critical paths**:
   - Slash command dispatch to each registered agent
   - Smart auto-routing fallback to `code` agent on LLM failure
   - Cache hit returns stored response without re-executing agent
   - GuardRails checkpoint created for autonomous agents
   - Rate-limit middleware rejects when limit exceeded
   - Error in agent triggers `onError` middleware hooks

5. **Test agent chaining and collaboration**:
   - `AgentRegistry.chain()` executes agents sequentially
   - `AgentCollaboration` voting/debate produces consensus

6. **Run and validate**:
   ```bash
   npm run compile && npm test
   npm run test:e2e
   npm run test:coverage  # Verify pipeline paths are covered
   ```

## Quality Checklist
- [ ] Full pipeline exercised from input to output
- [ ] smartRoute tested with known and unknown prompts
- [ ] Middleware execution order verified (before → handle → after)
- [ ] Cache hit/miss paths both tested
- [ ] GuardRails checkpoint and rollback tested for autonomous agents
- [ ] Error propagation through pipeline verified

## Pitfalls to Avoid
- Don't test agents in isolation here — that's for unit tests
- Don't skip middleware — it's part of the pipeline contract
- Don't forget to clear ResponseCache between tests to avoid false cache hits
- Don't hardcode agent lists — discover from registry
- Don't ignore CancellationToken — test cancellation mid-pipeline
````
