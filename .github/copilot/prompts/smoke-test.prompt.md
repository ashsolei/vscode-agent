````prompt
---
mode: "agent"
description: "Create smoke tests — verify extension activates, agents register, commands work, chat participant responds, cache operates"
---

# Smoke Tests

You are a QA engineer for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents, MiddlewarePipeline, ResponseCache, AgentMemory). You will create lightweight smoke tests that verify core functionality works after any change.

## Workflow

1. **Define smoke test scope** — fast, critical-path checks:
   - Extension activates without error
   - All 30+ agents register in `AgentRegistry`
   - All commands in `package.json` are registered
   - Chat Participant `@agent` is available
   - ResponseCache stores and retrieves entries
   - AgentMemory persists and recalls data
   - MiddlewarePipeline executes without crashing
   - ConfigManager loads `.agentrc.json`

2. **Create unit-level smoke tests** at `src/test/smoke.test.ts`:
   ```typescript
   import { describe, it, expect, vi, beforeEach } from 'vitest';

   describe('Smoke Tests', () => {
     beforeEach(() => vi.clearAllMocks());

     it('AgentRegistry registers all agents without error', () => {
       // Import registry, register agents, verify count ≥30
     });

     it('ResponseCache stores and retrieves', () => {
       // Put a value, get it back, verify match
     });

     it('AgentMemory remember and recall', () => {
       // Store a memory, recall it, verify content
     });

     it('MiddlewarePipeline executes with no middleware', () => {
       // Empty pipeline should pass through without error
     });

     it('ConfigManager handles missing .agentrc.json', () => {
       // Should use defaults, not throw
     });
   });
   ```

3. **Create E2E smoke tests** at `src/test/suite/smoke.e2e.ts`:
   ```typescript
   import * as assert from 'assert';
   import * as vscode from 'vscode';

   suite('E2E Smoke Tests', () => {
     test('extension activates', async () => {
       const ext = vscode.extensions.getExtension('undefined_publisher.vscode-agent');
       await ext?.activate();
       assert.ok(ext?.isActive);
     });

     test('commands are registered', async () => {
       const cmds = await vscode.commands.getCommands(true);
       assert.ok(cmds.includes('vscodeAgent.healthCheck'));
     });
   });
   ```

4. **Run smoke tests**:
   ```bash
   npm run compile           # Must compile first
   npm test -- --grep smoke  # Run smoke tests only
   npm run test:e2e          # Run E2E smoke tests
   ```

5. **Add to CI as first gate** — smoke tests run before full test suite:
   ```yaml
   - name: Smoke tests
     run: npm test -- --grep smoke
   - name: Full test suite
     run: npm test
   ```

## Quality Checklist
- [ ] Smoke tests run in <10 seconds total
- [ ] All core modules have at least one smoke test
- [ ] E2E smoke test verifies extension activation
- [ ] Smoke tests are independent — no ordering dependencies
- [ ] Smoke tests use the centralized VS Code mock
- [ ] CI runs smoke tests as the first quality gate

## Pitfalls to Avoid
- Don't make smoke tests comprehensive — they test "does it start", not "is it correct"
- Don't add network/LLM calls to smoke tests — they must be fast and offline
- Don't skip the E2E smoke test — unit mocks can hide activation failures
- Don't couple smoke tests to specific agent implementations — test the registry
- Don't forget to clear mocks between tests with `vi.clearAllMocks()`
````
