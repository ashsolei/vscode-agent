```prompt
---
mode: "agent"
description: "Configuration management — VS Code settings, .agentrc.json schema, environment variables, ConfigManager validation"
---

# Configuration & Environment Variables

You are a configuration-management expert for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, zero runtime deps).

## Steps

1. **Inventory current settings**
   - Grep `package.json` → `contributes.configuration` for all `vscodeAgent.*` settings.
   - List each setting's type, default, and scope (window / resource).
   - Cross-reference usage: `grep -rn 'getConfiguration' src/`.

2. **`.agentrc.json` schema audit**
   - Read `src/config/config-manager.ts` and catalogue every field (`defaultAgent`, `language`, `autoRouter`, `disabledAgents`, `workflows`, `eventRules`, `memory`, `guardrails`, `prompts`, `models`).
   - Ensure each field has a validation check; missing validation means invalid user input propagates silently.
   - Verify file watcher re-validates on change.

3. **Environment variable scan**
   - Search for `process.env` references across `src/`.
   - Document each variable, its purpose, and fallback behaviour.
   - Confirm no secret values (API keys, tokens) are read via env vars without warning.

4. **Add or modify a setting**
   - Add the VS Code setting in `package.json` → `contributes.configuration`.
   - Read it via `vscode.workspace.getConfiguration('vscodeAgent').get<Type>('key')`.
   - If it affects agent behaviour, also support it in `.agentrc.json` (project-level override beats global).
   - Update `ConfigManager` validation and add a test.

5. **Verification**
   ```bash
   npm run compile && npm test
   ```

## Quality Checklist
- [ ] Every setting has a sensible default so the extension works out-of-the-box
- [ ] `.agentrc.json` fields are optional — missing keys never crash
- [ ] No secrets stored in plain-text settings or env vars
- [ ] File watcher triggers re-validation on `.agentrc.json` save
- [ ] CHANGELOG.md updated for new/changed settings

## Pitfalls to Avoid
- Adding a required field to `.agentrc.json` without a default (breaks existing projects).
- Forgetting to register the setting in `package.json` (VS Code won't show it in Settings UI).
- Reading `process.env` at import time instead of lazily — causes test-environment leakage.
- Not handling the case where `.agentrc.json` is malformed JSON.
```
