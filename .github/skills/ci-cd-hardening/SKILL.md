---
name: "CI/CD Hardening"
description: "Harden GitHub Actions pipelines: security scanning, coverage thresholds, artifact caching, matrix testing (Node 18/20), branch protection"
argument-hint: "Pipeline aspect to harden"
---

# CI/CD Hardening

Harden the CI/CD pipeline for the VS Code Agent extension. Covers security scanning, test coverage enforcement, dependency caching, Node.js version matrix, branch protection, and artifact management.

## Workflow

1. **Audit** the current pipeline for gaps (security, coverage, caching).
2. **Add matrix testing** — Node 18 and 20 on ubuntu-latest.
3. **Enable caching** — `actions/cache` for `node_modules` keyed on `package-lock.json`.
4. **Set coverage thresholds** — enforce via `vitest.config.ts` or CI script.
5. **Add security scanning** — `npm audit`, CodeQL, or similar.
6. **Configure branch protection** — require status checks, reviews, linear history.
7. **Validate** — push to a feature branch and confirm all checks pass.

## Templates

### Matrix build with caching

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run compile
      - run: npm run lint
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: matrix.node-version == 20
        with:
          name: coverage-report
          path: coverage/
```

### Coverage threshold enforcement

```bash
# In CI, after `npm run test:coverage`
COVERAGE=$(npx vitest run --coverage --reporter=json \
  | jq '.total.lines.pct')
if (( $(echo "$COVERAGE < 80" | bc -l) )); then
  echo "Coverage $COVERAGE% is below 80% threshold" && exit 1
fi
```

### Security scanning step

```yaml
      - name: Security audit
        run: npm audit --audit-level=high
      - name: Check for known vulnerabilities
        run: npx audit-ci --high
```

## Rules

- The extension has **zero runtime dependencies** — `npm audit` may report only devDependency issues.
- TypeScript compilation (`npm run compile`) must pass before tests run.
- ESLint (`npm run lint`) uses `@typescript-eslint/recommended`; treat warnings as errors in CI.
- Vitest is the test runner — configuration lives in `vitest.config.ts`.
- Unit tests: `npm test`. E2E tests: `npm run test:e2e` (requires VS Code via `@vscode/test-electron`).
- The VS Code mock at `src/__mocks__/vscode.ts` enables unit tests without a VS Code instance.
- Cache key must include `package-lock.json` hash for correctness.
- Pin all GitHub Actions to full commit SHAs or major versions (`@v4`).

## Checklist

- [ ] Node 18 and 20 matrix builds pass
- [ ] `npm ci` uses cached `node_modules` on subsequent runs
- [ ] `npm run compile` succeeds (TypeScript strict mode, ES2022)
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm test` passes with coverage above threshold
- [ ] `npm audit --audit-level=high` reports no high/critical issues
- [ ] VSIX artifact uploaded on successful Node 20 build
- [ ] Branch protection requires passing status checks before merge
- [ ] Required reviewers configured on main branch
