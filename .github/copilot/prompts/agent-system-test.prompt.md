---
mode: "agent"
description: "Test the agent system — validate outputs for known inputs, check regressions, verify quality gates, measure effectiveness"
---

# Agent System Testing

You are a QA engineer for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, Vitest, AgentRegistry, MiddlewarePipeline, GuardRails).

## Steps

1. **Inventory agents and existing tests**
   - List all registered agents from `src/agents/index.ts` and `src/extension.ts`.
   - Check coverage: find agents missing test files in `src/agents/<name>.test.ts`.
   - Review `src/agents/registry.test.ts` and `registry-extended.test.ts` for patterns.

2. **Design golden-input test cases**
   - For each agent, define 2-3 known-input/expected-output pairs.
   - Focus on: correct Swedish UI strings, proper `AgentResult` shape, follow-up generation.
   - Write tests using Vitest and the mock pattern from `src/__mocks__/vscode.ts`.
   ```bash
   npm test -- --reporter=verbose 2>&1 | head -80
   ```

3. **Validate agent registration and routing**
   - Test that `AgentRegistry.resolve(slashCommand)` returns the correct agent.
   - Test `smartRoute()` routes ambiguous prompts to reasonable agents.
   - Verify `setDefault('code')` is applied and fallback works.
   - Ensure no duplicate agent IDs in the registry.

4. **Test middleware and guardrails**
   - Verify `MiddlewarePipeline` before/after/onError hooks execute in order.
   - Test `GuardRails` checkpoint creation and rollback for autonomous agents.
   - See existing tests in `src/middleware/middleware.test.ts` and `src/guardrails/guardrails.test.ts`.

5. **Regression testing**
   - Run the full suite and capture baseline: `npm test -- --reporter=json > baseline.json`.
   - After changes, diff against baseline to detect regressions.
   ```bash
   npm run compile && npm test
   ```

6. **Measure effectiveness**
   - Calculate test coverage per module: `npm run test:coverage`.
   - Identify modules below 80% coverage and create test backlog.
   - Document findings and next steps.

## Quality Checklist
- [ ] Every agent has at least one test file
- [ ] AgentRegistry routing tested for all slash commands
- [ ] Middleware hooks tested in isolation and in pipeline
- [ ] GuardRails checkpoint/rollback tested for autonomous agents
- [ ] Test coverage reported and gaps documented

## Pitfalls to Avoid
- Testing against live LLM APIs — always mock via `src/__mocks__/vscode.ts`.
- Relying on `ResponseCache` during tests — disable or clear cache in test setup.
- Writing tests that depend on agent registration order without verifying it.
- Skipping `isAutonomous` flag verification for agents that modify files.
- Not running `npm run compile` before `npm test` — TypeScript errors break tests silently.
