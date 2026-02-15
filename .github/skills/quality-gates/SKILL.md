---
name: "Quality Gates"
description: "Define and enforce quality gates: npm run compile, npm run lint, npm test, security scan, coverage thresholds, VSIX packaging"
argument-hint: "Gate type or 'all'"
---

# Quality Gates

Define and enforce quality gates for the VS Code Agent extension. Every change must pass compile, lint, test, and packaging before merging. Use the companion script `run-all.sh` for local validation.

## Workflow

1. **Identify** which gate(s) apply — compile, lint, test, security, coverage, or package.
2. **Run** the gate(s) via npm scripts or `run-all.sh`.
3. **Evaluate** — a gate fails if exit code ≠ 0 or coverage drops below threshold.
4. **Fix** failures before proceeding; do not skip gates.
5. **Verify** the full suite passes with `bash .github/skills/quality-gates/run-all.sh`.

## Gate Definitions

| Gate | Command | Pass Criteria |
|------|---------|---------------|
| Compile | `npm run compile` | tsc exits 0, no type errors |
| Lint | `npm run lint` | eslint exits 0, no warnings treated as errors |
| Unit Test | `npm test` | Vitest exits 0, all tests pass |
| Coverage | `npm run test:coverage` | v8 coverage ≥ configured threshold |
| Security | `npm audit --audit-level=high` | No high/critical vulnerabilities |
| Package | `npm run package` | `vsce package --no-dependencies` produces valid VSIX |
| E2E | `npm run test:e2e` | @vscode/test-electron exits 0 |

## Companion Script Reference

`run-all.sh` runs compile, lint, test, and package in sequence, aborting on first failure:

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "=== Compile ===" && npm run compile
echo "=== Lint ===" && npm run lint
echo "=== Test ===" && npm test
echo "=== Package ===" && npm run package
echo "All gates passed."
```

## Templates

### Workflow quality gate step

```json
{
  "name": "quality-check",
  "agentId": "code",
  "prompt": "Run npm run compile && npm run lint && npm test and report results",
  "condition": { "ifStep": 0, "is": "succeeded" }
}
```

### CI gate in `.agentrc.json`

```json
{
  "workflows": {
    "ci": {
      "description": "CI quality gates",
      "steps": [
        { "agentId": "code", "prompt": "Compile the project" },
        { "agentId": "security", "prompt": "Run npm audit" },
        { "agentId": "test", "prompt": "Run all tests with coverage" }
      ]
    }
  }
}
```

## Rules

- **Zero runtime dependencies** — `npm ls --prod` must list nothing. This is a hard gate.
- All TypeScript must compile under strict mode (`tsconfig.json` target ES2022, Node16 resolution).
- Lint uses `@typescript-eslint/recommended`; do not disable rules without justification.
- Tests are co-located (`src/agents/registry.test.ts`, `src/cache/cache.test.ts`, etc.).
- Coverage threshold failures block packaging.
- VSIX must build with `--no-dependencies` to enforce zero runtime deps.

## Checklist

- [ ] `npm run compile` passes with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm test` passes — all Vitest suites green
- [ ] `npm run test:coverage` meets coverage threshold
- [ ] `npm audit --audit-level=high` reports no high/critical issues
- [ ] `npm run package` produces a valid `.vsix` file
- [ ] No new runtime dependencies introduced in `package.json`
- [ ] `run-all.sh` completes successfully end-to-end
