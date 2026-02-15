```prompt
---
mode: "agent"
description: "Secrets audit — scan for hardcoded keys, check telemetry and logs for credential leaks, validate .agentrc.json safety"
---

# Secrets Hygiene

You are a security-focused auditor for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, zero runtime deps).

## Steps

1. **Scan for hardcoded secrets**
   - Run regex searches across `src/`:
     ```bash
     grep -rEnI '(api[_-]?key|secret|token|password|credential)\s*[:=]' src/
     grep -rEnI '[A-Za-z0-9+/]{40,}' src/  # base64-like blobs
     grep -rEnI 'sk-[a-zA-Z0-9]{20,}' src/  # OpenAI-style keys
     ```
   - Flag any match for manual review.

2. **Telemetry & logging audit**
   - Read `src/telemetry/` and `src/dashboard/agent-dashboard.ts`.
   - Verify user prompts are not logged verbatim — they may contain secrets pasted by the user.
   - Confirm `AgentMemory` stored in `globalState` does not persist raw credentials.
   - Check `MiddlewarePipeline` timing/usage hooks do not capture request bodies.

3. **`.agentrc.json` safety**
   - Ensure `ConfigManager` never reads or stores API keys from the config file.
   - If future fields need secrets, recommend `vscode.SecretStorage` instead.
   - Verify `.agentrc.json` is listed in `.gitignore` guidance or warn if it could be committed with secrets.

4. **Plugin and integration surface**
   - Check `PluginLoader` — plugin JSON must not accept executable URLs or auth tokens.
   - Check `ExternalIntegrations` for outbound HTTP calls — ensure no credentials in query strings.

5. **Verification**
   ```bash
   npm run compile && npm test
   grep -rn 'SecretStorage' src/  # confirm usage if secrets are needed
   ```

## Quality Checklist
- [ ] Zero hardcoded secrets in source
- [ ] Telemetry and dashboard never log raw user prompts
- [ ] `AgentMemory` scrubs sensitive patterns before persisting
- [ ] `.agentrc.json` docs warn against storing secrets
- [ ] Plugins cannot inject credentials via config

## Pitfalls to Avoid
- Logging full `AgentContext.request.prompt` in error handlers — may contain user secrets.
- Storing OAuth tokens in `globalState` instead of `SecretStorage`.
- Trusting plugin-provided URLs without validation.
- Ignoring environment variables that might leak into child processes via `AutonomousExecutor.runCommand()`.
```
