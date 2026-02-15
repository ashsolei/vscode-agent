---
mode: "agent"
description: "Write comprehensive Vitest tests for a module — follows the project's VS Code mock and testing patterns"
---

# Write Tests

Generate a complete test suite for the specified module using Vitest.

## Process

1. Read the source file to understand the API surface
2. Identify all public methods and edge cases
3. Create the test file at `src/<module>/<name>.test.ts`

## Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyClass } from './<name>';

describe('MyClass', () => {
  let instance: MyClass;

  beforeEach(() => {
    vi.clearAllMocks();
    instance = new MyClass();
  });

  it('should handle the happy path', () => {
    // Arrange, Act, Assert
  });

  it('should handle errors gracefully', () => {
    // Test error scenarios
  });

  it('should handle edge cases', () => {
    // Empty input, null, undefined, boundary values
  });
});
```

## Rules

- Use the centralized VS Code mock at `src/__mocks__/vscode.ts` — don't create per-test mocks
- If a VS Code API is missing from the mock, add it to `src/__mocks__/vscode.ts`
- Test file lives alongside source: `src/<module>/<name>.test.ts`
- Use `vi.fn()` for function mocks, `vi.clearAllMocks()` in `beforeEach`
- Cover: happy path, error handling, edge cases, boundary values
- For agents, use the `TestAgent` + `makeCtx()` helpers from `registry-extended.test.ts`
- Run: `npm test` to verify
