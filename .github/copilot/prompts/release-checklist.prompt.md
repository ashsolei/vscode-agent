````prompt
---
mode: "agent"
description: "Complete release checklist — version bump, CHANGELOG, full CI, VSIX build, local test, tag, publish"
---

# Release Checklist

You are the release manager for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, vsce packaging, Docker build). You will execute every step for a safe, reproducible release.

## Workflow

1. **Pre-release validation**:
   ```bash
   git status          # Clean working tree
   git pull origin main
   npm ci              # Fresh install from lockfile
   npm run compile     # Zero TS errors
   npm run lint        # Zero ESLint violations
   npm test            # All Vitest tests pass
   npm run test:coverage  # Coverage ≥80%
   npm run test:e2e    # Integration tests pass
   ```

2. **Version bump**: Update version in `package.json` following semver:
   - PATCH: bug fixes, docs updates
   - MINOR: new agents, commands, non-breaking features
   - MAJOR: breaking changes to agent API, config format
   ```bash
   npm version <patch|minor|major> --no-git-tag-version
   ```

3. **Update CHANGELOG.md**: Add entry under new version heading with date. Group changes: Added, Changed, Fixed, Removed. Reference PR/issue numbers.

4. **Build VSIX**:
   ```bash
   npm run package   # vsce package --no-dependencies
   ls -lh *.vsix     # Verify artifact size is reasonable (<5MB)
   ```

5. **Local smoke test**: Install the VSIX in VS Code:
   ```bash
   code --install-extension *.vsix
   ```
   Verify: extension activates, `@agent` chat participant loads, `/code` command works, health check passes.

6. **Docker build verification**:
   ```bash
   docker build -t vscode-agent .
   ```

7. **Tag and push**:
   ```bash
   git add -A
   git commit -m "release: v$(node -p 'require(\"./package.json\").version')"
   git tag "v$(node -p 'require(\"./package.json\").version')"
   git push origin main --tags
   ```

8. **Publish** (if applicable):
   ```bash
   npx vsce publish   # To VS Code Marketplace
   ```

## Quality Checklist
- [ ] All tests pass (unit, integration, E2E)
- [ ] Coverage threshold met (≥80%)
- [ ] CHANGELOG updated with all changes since last release
- [ ] Version bumped correctly per semver
- [ ] VSIX builds successfully and is <5MB
- [ ] Local smoke test passed
- [ ] Git tag matches `package.json` version
- [ ] No uncommitted changes after release commit

## Pitfalls to Avoid
- Don't release from a dirty working tree
- Don't skip E2E tests — unit tests alone miss integration bugs
- Don't forget `--no-dependencies` in `vsce package` — no runtime deps
- Don't tag before the release commit is pushed
- Don't publish without the local smoke test
````
