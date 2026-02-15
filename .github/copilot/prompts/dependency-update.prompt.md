---
mode: "agent"
description: "Safely update, audit, and manage project dependencies — check for vulnerabilities, outdated packages, and compatibility"
---

# Dependency Update Workflow

Manage dependencies for the VS Code Agent extension.

## Important Constraints

- **Zero runtime dependencies** — the extension ships with NO `dependencies` field
- All packages live in `devDependencies`
- Current dev dependencies:
  - `typescript` ~5.3.x — compiler
  - `@types/vscode` ^1.93.0 — VS Code API types
  - `@types/node` 18.x — Node.js types
  - `eslint` + `@typescript-eslint/*` — linting
  - `vitest` ^2.0.0 — test runner
  - `@vscode/test-electron` — E2E testing
  - `@vscode/vsce` — packaging

## Update Process

1. **Check what's outdated**
   ```bash
   npm outdated
   ```

2. **Review each update for breaking changes**
   - Check changelogs for major version bumps
   - Run `npm run compile` after each update
   - Run `npm test` to verify

3. **Update @types/vscode carefully**
   - Must match the `engines.vscode` field in package.json (^1.93.0)
   - Newer types may reference APIs not available in the minimum version
   - Check `vscode.proposed.*.d.ts` for proposed API changes

4. **After updates**
   ```bash
   npm run compile && npm run lint && npm test
   ```

## Rules

- NEVER add a `dependencies` entry — use VS Code built-in APIs instead
- Pin TypeScript to minor version (~5.3.x) to avoid unexpected breaks
- Keep @types/vscode aligned with engines.vscode minimum
- Run full CI pipeline before committing updates
