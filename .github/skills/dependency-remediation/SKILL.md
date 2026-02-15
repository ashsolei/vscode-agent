---
name: "Dependency Remediation"
description: "Remediate dependency issues: audit with npm audit, update vulnerabilities, ensure zero runtime deps, verify @types/vscode alignment"
argument-hint: "Dependency to remediate or 'all'"
---

# Dependency Remediation

Remediate dependency issues in the VS Code Agent extension. Audit for vulnerabilities, enforce zero runtime dependencies, and keep `@types/vscode` aligned with the engine requirement.

## Workflow

1. **Audit** — run `npm audit` to identify known vulnerabilities.
2. **Classify** — determine severity (critical, high, moderate, low) and whether the dep is dev-only.
3. **Remediate** — update, replace, or remove the vulnerable dependency.
4. **Verify zero runtime deps** — `npm ls --prod` must produce an empty tree.
5. **Align VS Code types** — ensure `@types/vscode` version matches `engines.vscode: "^1.93.0"`.
6. **Validate** — run `npm run compile && npm test && npm run package`.

## Templates

### Full audit

```bash
npm audit
npm audit --audit-level=high
```

### Fix automatically where possible

```bash
npm audit fix
```

### Verify zero runtime dependencies

```bash
# Must show empty — the extension has zero "dependencies" in package.json
npm ls --prod
# Also verify package.json directly:
node -e "const p = require('./package.json'); console.log('deps:', Object.keys(p.dependencies || {}).length)"
```

### Check @types/vscode alignment

```bash
# Engine requires ^1.93.0, so @types/vscode should be ~1.93.0 or compatible
npm ls @types/vscode
```

### Update a specific devDependency

```bash
npm update <package-name>
# Or for major version bumps:
npm install <package-name>@latest --save-dev
```

### Verify VSIX builds without runtime deps

```bash
npm run package  # runs: vsce package --no-dependencies
```

## Key DevDependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler (strict mode, ES2022) |
| `vitest` | Unit test framework |
| `@types/vscode` | VS Code API type definitions — must align with `^1.93.0` |
| `@vscode/test-electron` | Integration/E2E test runner |
| `eslint` / `@typescript-eslint/*` | Linting |
| `@vscode/vsce` | Extension packaging |

## Rules

- **Zero runtime dependencies is a hard constraint.** The `dependencies` field in `package.json` must remain empty. All deps are `devDependencies`.
- `@types/vscode` version must be compatible with `engines.vscode: "^1.93.0"` — do not use types for APIs unavailable in 1.93.
- `npm audit --audit-level=high` must pass with no high or critical vulnerabilities.
- When updating dependencies, run the full quality gate: compile, lint, test, package.
- VSIX is built with `vsce package --no-dependencies` — this flag enforces no bundled runtime deps.
- Never add a runtime dependency; if external functionality is needed, use the `vscode.*` API.
- Lock file (`package-lock.json`) must be committed after any dependency change.

## Checklist

- [ ] `npm audit` run and results reviewed
- [ ] No high or critical vulnerabilities (`npm audit --audit-level=high` exits 0)
- [ ] Vulnerable devDependencies updated or replaced
- [ ] `npm ls --prod` confirms zero runtime dependencies
- [ ] `@types/vscode` version aligns with `engines.vscode: "^1.93.0"`
- [ ] `package-lock.json` committed after changes
- [ ] `npm run compile` passes after dependency changes
- [ ] `npm test` passes after dependency changes
- [ ] `npm run package` produces valid VSIX
- [ ] No new runtime dependencies introduced
