---
name: "Agent Versioning"
description: "Version control for agent system: semantic versioning for agents/skills/prompts, CHANGELOG generation, rollback procedures, migration guides"
argument-hint: "Component to version"
---

# Agent Versioning

Manage versioning for the VS Code Agent extension: the extension itself, individual agents, skill files, system prompts, and configuration. Covers semantic versioning, changelogs, rollback, and migration.

## Workflow

1. **Determine** what changed — extension version, agent behavior, skill content, prompt template, or config schema.
2. **Classify** the change — major (breaking), minor (new feature), or patch (fix).
3. **Update** version numbers in the appropriate locations.
4. **Generate** or update the CHANGELOG entry.
5. **Tag** the release in git.
6. **Validate** — `npm run compile && npm test && npm run package`.

## Version Locations

| Component | Version Location | Format |
|-----------|-----------------|--------|
| Extension | `package.json` `version` field | semver (`0.1.0`) |
| Agents | Agent constructor description or internal version | string in constructor |
| Skills | YAML frontmatter or git history | implicit via git |
| Prompts | `src/prompts/system-prompts.ts` | hash-based drift detection |
| Config schema | `.agentrc.json` | `schemaVersion` field |
| VSIX artifact | Built from `package.json` version | `vscode-agent-X.Y.Z.vsix` |

## Templates

### Updating extension version

```bash
# Bump version in package.json
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.0 → 0.2.0
npm version major  # 0.1.0 → 1.0.0

# This auto-updates package.json and creates a git tag
```

### CHANGELOG entry format

```markdown
## [0.2.0] - 2026-02-15
### Tillagt
- Ny agent: `metrics` — spårar systemhälsa och prestanda
### Ändrat
- `ModelSelector` stöder nu per-agent modellval via `.agentrc.json`
### Fixat
- `ResponseCache` TTL-beräkning korrigerad
```

### Agent version tracking

```typescript
export class MetricsAgent extends BaseAgent {
    static readonly VERSION = '1.0.0';

    constructor() {
        super(
            'metrics',
            'Spåra och visualisera agentsystemets hälsa (v1.0.0)',
            { isAutonomous: false }
        );
    }

    get version(): string {
        return MetricsAgent.VERSION;
    }
}
```

## Rules

- Extension version lives in `package.json` — this is the single source of truth.
- `CHANGELOG.md` uses Swedish for section content (Tillagt, Ändrat, Fixat, Borttaget).
- `npm version` auto-creates git tags — do not manually edit `package.json` version.
- Agent versions are optional but recommended for agents with public-facing behavior.
- Prompt hashes enable drift detection in tests (see `agent-testing-framework` skill).
- Config schema changes require a migration function in `ConfigManager` (`src/config/config-manager.ts`).
- `.agentrc.json` is loaded by `ConfigManager` with a file watcher — schema changes must be backward-compatible.
- `vsce package --no-dependencies` uses the `package.json` version — always bump before packaging.
- Git tags follow `vX.Y.Z` format (e.g., `v0.2.0`).

## Checklist

- [ ] `package.json` version bumped via `npm version [patch|minor|major]`
- [ ] `CHANGELOG.md` updated with categorized changes in Swedish
- [ ] Agent version constants updated for changed agents
- [ ] System prompt hashes updated in tests if prompts changed
- [ ] Config schema migration function added for breaking config changes
- [ ] `npm run compile && npm test` passes after version bump
- [ ] `npm run package` produces correctly versioned VSIX
- [ ] Git tag created: `git tag v$(node -p "require('./package.json').version")`
- [ ] Release notes reference relevant issues or PRs
