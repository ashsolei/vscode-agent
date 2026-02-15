---
name: "Test Triage"
description: "Triage test failures: categorize (flaky, regression, environment), identify root cause, fix or quarantine, prevent recurrence"
argument-hint: "Test failure to triage"
---

# Test Triage

Triage test failures in the VS Code Agent extension. Categorize failures, identify root causes, fix or quarantine, and prevent recurrence.

## Workflow

1. **Reproduce** — run the failing test in isolation: `npx vitest run <path>` or `npm test -- --reporter=verbose`.
2. **Categorize** — classify the failure (see categories below).
3. **Root-cause** — inspect the error, trace through source code, check recent changes with `git log`.
4. **Fix or quarantine** — fix the root cause, or mark the test with `.skip` and file a tracking issue.
5. **Verify** — run the full suite `npm test` to confirm the fix doesn't break other tests.
6. **Prevent** — add regression guards or improve the test to prevent recurrence.

## Failure Categories

| Category | Description | Action |
|----------|-------------|--------|
| **Regression** | Code change broke a passing test | Fix the code or update the test if behavior changed intentionally |
| **Flaky** | Test passes/fails non-deterministically | Remove timing dependencies, add retries, or refactor |
| **Environment** | Fails only in certain environments (CI vs local) | Check Node version, VS Code mock, OS-specific paths |
| **Type Error** | TypeScript compilation failure in test | Fix types; run `npm run compile` first |
| **Mock Issue** | VS Code mock at `src/__mocks__/vscode.ts` missing API | Extend the mock to cover the needed API surface |

## Templates

### Isolate a single test file

```bash
npx vitest run src/agents/registry.test.ts --reporter=verbose
```

### Run tests in watch mode for fast iteration

```bash
npm run test:watch
```

### Quarantine a flaky test

```typescript
describe('FlakeyModule', () => {
  it.skip('should handle race condition — QUARANTINED #123', () => {
    // TODO: Fix non-deterministic timing issue
  });
});
```

### Check recent changes that might have caused the failure

```bash
git log --oneline -10 -- src/agents/
git diff HEAD~3 -- src/middleware/middleware.ts
```

### Inspect test coverage for the failing module

```bash
npm run test:coverage -- --reporter=verbose
```

## Rules

- **Never delete a failing test** without understanding why it fails; quarantine with `.skip` and a tracking comment.
- Always reproduce locally before investigating — `npx vitest run <file>`.
- Check `src/__mocks__/vscode.ts` if the failure involves VS Code API calls.
- Flaky tests must be fixed or quarantined within one sprint; do not leave them failing in CI.
- Vitest config is at `vitest.config.ts` — check for relevant settings (timeouts, setup files).
- Test files are co-located: `src/cache/cache.test.ts`, `src/guardrails/guardrails.test.ts`, etc.
- After fixing, run the full suite to catch cascading issues: `npm test`.
- For integration test failures (`npm run test:e2e`), check `@vscode/test-electron` version alignment.

## Checklist

- [ ] Failure reproduced locally with `npx vitest run <path>`
- [ ] Category identified (regression, flaky, environment, type error, mock issue)
- [ ] Root cause identified and documented
- [ ] Fix implemented or test quarantined with `.skip` and tracking comment
- [ ] `npm test` passes after fix — no new failures introduced
- [ ] `npm run compile` passes — no type errors
- [ ] Regression test added if the failure revealed a gap
- [ ] Flaky test root cause addressed (timing, state leakage, mock gaps)
- [ ] `src/__mocks__/vscode.ts` updated if mock was incomplete
- [ ] Prevention measure documented or implemented
