---
name: "Testing Pyramid"
description: "Implement the testing pyramid: unit tests (Vitest co-located), integration tests (@vscode/test-electron), E2E tests, smoke tests"
argument-hint: "Module or layer to test"
---

# Testing Pyramid

Implement the full testing pyramid for the VS Code Agent extension: fast unit tests with Vitest, integration tests via `@vscode/test-electron`, and E2E smoke tests.

## Workflow

1. **Identify** the module and appropriate test layer (unit, integration, or E2E).
2. **Write unit tests** first — co-located `.test.ts` files using Vitest.
3. **Write integration tests** for cross-module behavior using `@vscode/test-electron`.
4. **Write E2E tests** for user-facing workflows.
5. **Run** — `npm test` (unit), `npm run test:e2e` (E2E), `npm run test:coverage` (coverage).
6. **Validate** coverage meets thresholds.

## Layer Definitions

| Layer | Framework | Location | Speed | Command |
|-------|-----------|----------|-------|---------|
| Unit | Vitest | `src/**/*.test.ts` (co-located) | Fast | `npm test` |
| Integration | @vscode/test-electron | `src/test/` | Medium | `npm run test:e2e` |
| E2E / Smoke | @vscode/test-electron | `src/test/` | Slow | `npm run test:e2e` |

## Templates

### Unit test — agent (`src/agents/<name>.test.ts`)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { CodeAgent } from './code-agent';

describe('CodeAgent', () => {
  it('should have id "code"', () => {
    const agent = new CodeAgent();
    expect(agent.id).toBe('code');
    expect(agent.isAutonomous).toBe(false);
  });
});
```

### Unit test — middleware (`src/middleware/middleware.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { MiddlewarePipeline } from './middleware';

describe('MiddlewarePipeline', () => {
  it('should sort middlewares by priority', () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use({ name: 'b', priority: 200 });
    pipeline.use({ name: 'a', priority: 50 });
    // Verify ordering
  });
});
```

### Unit test — cache (`src/cache/cache.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { ResponseCache } from './response-cache';

describe('ResponseCache', () => {
  it('should return undefined for cache miss', () => {
    const cache = new ResponseCache();
    expect(cache.get('nonexistent')).toBeUndefined();
  });
});
```

### VS Code API mock (`src/__mocks__/vscode.ts`)

The project provides a VS Code API mock at `src/__mocks__/vscode.ts` for Vitest. All unit tests use this mock — no real VS Code instance required.

## Rules

- **Unit tests are co-located** — `src/agents/registry.test.ts` tests `src/agents/index.ts`.
- Use the VS Code mock at `src/__mocks__/vscode.ts`; do not install additional mock libraries.
- Vitest configuration is in `vitest.config.ts` at the project root.
- Coverage uses the v8 provider: `npm run test:coverage`.
- Watch mode available: `npm run test:watch`.
- Integration/E2E tests run in a real VS Code instance via `@vscode/test-electron`.
- Tests must not depend on network access or external services.
- Every new module must have at least one co-located test file.
- Zero runtime dependencies — test dependencies go in `devDependencies` only.

## Checklist

- [ ] Unit test file created co-located with source (`<module>.test.ts`)
- [ ] Tests use `vitest` imports: `describe`, `it`, `expect`, `vi`
- [ ] VS Code mock used (`src/__mocks__/vscode.ts`) — no real VS Code in unit tests
- [ ] `npm test` passes with all new tests green
- [ ] `npm run test:coverage` meets coverage thresholds
- [ ] Integration tests added in `src/test/` where cross-module behavior is tested
- [ ] No flaky tests — deterministic, no timing dependencies
- [ ] Test names are descriptive (`should X when Y`)
- [ ] No runtime dependencies added for testing
