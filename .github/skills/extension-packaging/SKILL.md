---
name: "Extension Packaging"
description: "Package, publish, and release the VS Code extension — VSIX building, marketplace publishing, versioning, and Docker builds"
argument-hint: "What to do? e.g. 'create VSIX package' or 'prepare a release' or 'Docker build'"
---

# Extension Packaging Skill

Package and release the VS Code Agent extension.

## Build Pipeline

```
Source → compile (tsc) → lint (eslint) → test (vitest) → package (vsce) → VSIX
```

## Commands

### Local Development
```bash
npm run compile          # TypeScript → JavaScript
npm run watch            # Watch mode compilation
npm run lint             # ESLint check
npm test                 # Run all Vitest tests
npm run test:coverage    # Tests with v8 coverage report
```

### Packaging
```bash
npm run package          # Create .vsix file
# Runs: vsce package --no-dependencies
```

The `--no-dependencies` flag is critical because the extension has zero runtime dependencies.

### Docker Build
```bash
docker build -t vscode-agent .
# Multi-stage build:
#   Stage 1: npm ci + compile + test + package
#   Stage 2: Extract .vsix artifact
```

## VSIX Contents

The `.vsix` file includes:
```
extension/
  package.json           → extension manifest
  out/                   → compiled JavaScript
  media/                 → icons, walkthroughs
  README.md              → marketplace page
  CHANGELOG.md           → version history
  LICENSE                → license file
```

### Files Included/Excluded

Controlled by `.vscodeignore`:
```
.github/**
src/**               → source excluded (compiled JS in out/)
node_modules/**      → no runtime deps needed
*.test.ts
vitest.config.ts
tsconfig.json
.agentrc.json
.agent-plugins/**
```

## Versioning

Follow semantic versioning in `package.json`:
```json
{
    "version": "1.0.0"
}
```

- **Major**: Breaking changes to agent API or command names
- **Minor**: New agents, commands, or features
- **Patch**: Bug fixes, performance improvements

Update `CHANGELOG.md` for every version:
```markdown
## [1.1.0] - 2024-01-15
### Added
- New `security` agent for vulnerability scanning
### Fixed
- Cache invalidation on config change
```

## Release Checklist

1. **Update version** in `package.json`
2. **Update** `CHANGELOG.md` with changes
3. **Run full CI pipeline**:
   ```bash
   npm run compile && npm run lint && npm test
   ```
4. **Create VSIX**:
   ```bash
   npm run package
   ```
5. **Test locally**: Install VSIX in VS Code
   ```bash
   code --install-extension vscode-agent-*.vsix
   ```
6. **Tag release**:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
7. **CI/CD**: GitHub Actions picks up the tag and runs the release pipeline

## package.json Key Fields

```json
{
    "name": "vscode-agent",
    "displayName": "VS Code Agent",
    "engines": { "vscode": "^1.93.0" },
    "categories": ["AI", "Chat"],
    "activationEvents": [],
    "main": "./out/extension.js",
    "contributes": {
        "chatParticipants": [{ ... }],
        "commands": [{ ... }],
        "configuration": { ... }
    }
}
```

## Rules

- Always run tests before packaging
- Never include `node_modules` in the VSIX (no runtime deps)
- Keep `engines.vscode` at `^1.93.0` minimum
- Source TypeScript is NOT included in the package (only compiled JS)
- VSIX size target: < 500KB (no external dependencies)
