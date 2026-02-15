````prompt
---
mode: "agent"
description: "Harden CI pipeline — security scanning, test coverage thresholds, artifact signing, dependency auditing, matrix testing"
---

# CI Hardening

You are a DevSecOps engineer hardening the CI pipeline for the VS Code Agent extension (TypeScript, Vitest, @vscode/test-electron, Docker multi-stage, vsce packaging). You will add security, quality, and reliability gates.

## Workflow

1. **Audit current CI** in `.github/workflows/`:
   ```bash
   ls -la .github/workflows/
   cat .github/workflows/*.yml
   ```

2. **Add security scanning**:
   - `npm audit --audit-level=high` as a blocking step.
   - CodeQL or `github/codeql-action` for TypeScript static analysis.
   - Secret scanning with `truffleHog` or GitHub's built-in scanner.
   - Dependency review with `actions/dependency-review-action`.

3. **Enforce test coverage thresholds**:
   ```yaml
   - run: npm run test:coverage
   - run: |
       COVERAGE=$(npx vitest run --coverage --reporter=json | jq '.total.lines.pct')
       if (( $(echo "$COVERAGE < 80" | bc -l) )); then exit 1; fi
   ```

4. **Add matrix testing**:
   ```yaml
   strategy:
     matrix:
       os: [ubuntu-latest, macos-latest, windows-latest]
       node-version: [18, 20, 22]
   ```

5. **Add artifact signing and VSIX build**:
   ```yaml
   - run: npm run package  # vsce package --no-dependencies
   - uses: actions/upload-artifact@v4
     with:
       name: vsix-${{ matrix.os }}
       path: "*.vsix"
   ```

6. **Add E2E test step** (Linux only, headless):
   ```yaml
   - run: xvfb-run npm run test:e2e
     if: runner.os == 'Linux'
   ```

7. **Add dependency lock verification**:
   ```yaml
   - run: npm ci  # Fails if package-lock.json is out of sync
   ```

8. **Validate locally**:
   ```bash
   npm ci && npm run compile && npm run lint
   npm test && npm run test:coverage
   npm audit --audit-level=high
   npm run package
   ```

## Quality Checklist
- [ ] `npm audit` blocks on high/critical vulnerabilities
- [ ] Coverage threshold enforced (≥80% lines)
- [ ] Matrix covers Linux, macOS, Windows with Node 18/20/22
- [ ] VSIX artifact uploaded for each OS
- [ ] E2E tests run headless on Linux
- [ ] `npm ci` used instead of `npm install` for reproducibility

## Pitfalls to Avoid
- Don't use `npm install` in CI — `npm ci` ensures lockfile integrity
- Don't skip Windows testing — path separators differ
- Don't set coverage thresholds too high initially — ratchet up over time
- Don't forget `xvfb-run` for E2E tests on Linux headless runners
- Don't cache `node_modules` without hashing `package-lock.json`
````
