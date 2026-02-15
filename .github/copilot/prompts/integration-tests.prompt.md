````prompt
---
mode: "agent"
description: "Write integration tests using @vscode/test-electron for the Chat Participant, commands, and agent routing"
---

# Integration Tests

You are a test engineer for the VS Code Agent extension (VS Code ^1.93.0, 30+ agents, MiddlewarePipeline, AgentRegistry). You will write integration tests that run inside a real VS Code instance via `@vscode/test-electron`.

## Workflow

1. **Identify test targets**: Chat Participant registration, slash command dispatch, agent routing via `smartRoute()`, middleware pipeline execution, context provider injection, and command handler registration.

2. **Set up test files** in `src/test/`:
   - Test runner: `src/test/runTest.ts` (launches VS Code with test workspace).
   - Test suite: `src/test/suite/<name>.test.ts`.
   - Use `@vscode/test-electron` to bootstrap the extension host.

3. **Write integration tests**:
   ```typescript
   import * as assert from 'assert';
   import * as vscode from 'vscode';

   suite('Agent Extension Integration', () => {
     suiteSetup(async () => {
       const ext = vscode.extensions.getExtension('your.extension-id');
       await ext?.activate();
     });

     test('extension activates without error', () => {
       const ext = vscode.extensions.getExtension('your.extension-id');
       assert.ok(ext?.isActive);
     });

     test('all commands are registered', async () => {
       const cmds = await vscode.commands.getCommands(true);
       assert.ok(cmds.includes('vscodeAgent.healthCheck'));
     });

     test('agent routing resolves known slash commands', async () => {
       // Test that /code, /review, /test etc. resolve to correct agents
     });
   });
   ```

4. **Test middleware pipeline end-to-end**: Verify that timing, usage tracking, and rate-limit middleware execute in order. Assert that `onError` hooks fire on failures.

5. **Test GuardRails integration**: Verify checkpoint creation and rollback for autonomous agents.

6. **Run**:
   ```bash
   npm run test:e2e   # @vscode/test-electron runner
   npm run compile    # Ensure no TS errors
   ```

## Quality Checklist
- [ ] Tests run in a real VS Code instance, not mocked
- [ ] Extension activation is tested explicitly
- [ ] All registered commands are verified
- [ ] Agent routing covers known slash commands and fallback to `code` agent
- [ ] Tests clean up after themselves (no state leaks between suites)
- [ ] Tests pass in CI (headless via `xvfb-run` on Linux)

## Pitfalls to Avoid
- Don't mock `vscode` — integration tests use the real API
- Don't depend on network or LLM calls — mock model responses where needed
- Don't forget `suiteSetup` to activate the extension before tests run
- Don't assume command registration is synchronous — await activation
- Don't skip CI setup for headless display (`xvfb-run` is required on Linux)
````
