---
name: "Secure Config"
description: "Secure configuration management: validate .agentrc.json has no secrets, VS Code settings safety, ConfigManager validation"
argument-hint: "Config file to secure"
---

# Secure Config

Secure configuration management for the VS Code Agent extension. Ensure `.agentrc.json` contains no secrets, VS Code settings are safe, and `ConfigManager` validates all inputs.

## Workflow

1. **Scan** `.agentrc.json` for hardcoded secrets (API keys, tokens, passwords).
2. **Validate** the config structure against the `AgentConfig` interface (`src/config/config-manager.ts`).
3. **Check** VS Code settings under `vscodeAgent.*` for sensitive values.
4. **Verify** `ConfigManager` handles invalid JSON gracefully without crashing.
5. **Ensure** `.agentrc.json` is listed in `.gitignore` if it contains environment-specific values.

## Templates

### Safe `.agentrc.json` example

```json
{
  "defaultAgent": "code",
  "language": "sv",
  "autoRouter": true,
  "disabledAgents": ["fullstack"],
  "workflows": {
    "ci": {
      "description": "CI pipeline",
      "steps": [
        { "agentId": "test", "prompt": "Run all tests" },
        { "agentId": "security", "prompt": "Security scan" }
      ]
    }
  },
  "memory": { "enabled": true, "maxAge": 604800000 },
  "guardrails": { "confirmDestructive": true, "dryRunDefault": false },
  "prompts": {
    "code": "Du är en senior TypeScript-utvecklare."
  }
}
```

### Dangerous patterns to detect

```text
# These should NEVER appear in .agentrc.json or VS Code settings:
"apiKey": "sk-..."
"token": "ghp_..."
"password": "..."
"secret": "..."
"Authorization": "Bearer ..."
```

### ConfigManager validation pattern

```typescript
// ConfigManager (src/config/config-manager.ts) loads and watches .agentrc.json
// It must handle:
// 1. Missing file — use defaults
// 2. Invalid JSON — log warning, use defaults, do not crash
// 3. Unknown fields — ignore, do not error
// 4. Invalid types — validate and warn
```

### Scanning for secrets in config

```bash
# Quick scan for common secret patterns
grep -riE '(api[_-]?key|token|password|secret|bearer|authorization)' .agentrc.json
grep -riE '(sk-|ghp_|gho_|glpat-)' .agentrc.json
```

## Rules

- **Never store secrets** in `.agentrc.json` — it is a project-level config file and may be committed.
- `ConfigManager` must not crash on malformed JSON — use try/catch and fall back to defaults.
- VS Code settings (`vscodeAgent.*`) are stored in user/workspace settings JSON; scan both.
- The `prompts` field in `.agentrc.json` may contain custom system prompts — ensure they don't contain injection payloads.
- `eventRules` patterns use glob syntax — validate they don't match overly broad file sets.
- `disabledAgents` values must be valid agent IDs; log warnings for unrecognized IDs.
- Config file watcher in `ConfigManager` auto-reloads — changes take effect immediately.
- The `models` field maps agent IDs to model families — validate these are recognized values.

## Checklist

- [ ] `.agentrc.json` scanned for hardcoded secrets (API keys, tokens, passwords)
- [ ] No secret patterns found (`apiKey`, `token`, `password`, `secret`, `bearer`)
- [ ] Config validates against `AgentConfig` interface in `src/config/config-manager.ts`
- [ ] `ConfigManager` handles missing/malformed `.agentrc.json` gracefully
- [ ] VS Code settings under `vscodeAgent.*` reviewed for sensitive values
- [ ] `.agentrc.json` in `.gitignore` if it contains environment-specific data
- [ ] Custom `prompts` reviewed for injection content
- [ ] `eventRules` file patterns are appropriately scoped
- [ ] `disabledAgents` contains only valid agent IDs
- [ ] Config reload via file watcher tested
