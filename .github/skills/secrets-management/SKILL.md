---
name: "Secrets Management"
description: "Manage secrets safely: scan for hardcoded credentials, verify telemetry doesn't leak secrets, validate .gitignore covers sensitive files"
argument-hint: "Area to scan for secrets"
---

# Secrets Management

Manage secrets safely in the VS Code Agent extension. Scan for hardcoded credentials, verify telemetry and logging don't leak sensitive data, and ensure `.gitignore` covers all sensitive files.

## Workflow

1. **Scan source** — search `src/` for hardcoded credentials, API keys, and tokens.
2. **Scan config** — check `.agentrc.json`, `.env`, and VS Code settings for secrets.
3. **Audit telemetry** — verify `src/telemetry/` does not log sensitive user input or tokens.
4. **Audit logging** — ensure `AgentMemory` (`src/memory/agent-memory.ts`) doesn't persist secrets.
5. **Verify `.gitignore`** — confirm sensitive files are excluded from version control.
6. **Verify outputs** — ensure `ResponseCache` and `AgentDashboard` don't expose secrets.

## Templates

### Scan for hardcoded secrets in source

```bash
# Common secret patterns
grep -rnE '(api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*["\x27][^\s]+' src/

# Known key prefixes
grep -rnE '(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|gho_|glpat-|xox[bpas]-)' src/

# Bearer tokens
grep -rnE 'Bearer\s+[a-zA-Z0-9._-]+' src/
```

### Verify .gitignore coverage

```bash
# These files MUST be in .gitignore:
cat .gitignore | grep -E '(\.env|\.agentrc\.json|\.vsix|node_modules|out/)'
```

### Essential .gitignore entries

```text
node_modules/
out/
*.vsix
.env
.env.*
.agentrc.json
```

### Audit telemetry for secret leakage

```bash
# Check what telemetry captures
grep -rn 'sendTelemetry\|logEvent\|trackEvent' src/telemetry/
# Ensure user prompts are not logged verbatim with potential secrets
grep -rn 'request\.prompt' src/telemetry/
```

### Audit memory persistence

```bash
# AgentMemory persists data to globalState — check what is stored
grep -rn 'globalState\|workspaceState' src/memory/
# Ensure raw user input is sanitized before storage
grep -rn 'remember\|store\|persist' src/memory/
```

## Sensitive Areas

| Area | File(s) | Risk |
|------|---------|------|
| Agent Memory | `src/memory/agent-memory.ts` | May persist user prompts containing secrets |
| Telemetry | `src/telemetry/` | May log sensitive request data |
| Response Cache | `src/cache/response-cache.ts` | Caches agent responses that may contain secrets |
| Dashboard | `src/dashboard/agent-dashboard.ts` | Displays agent activity — may show sensitive data |
| Config | `.agentrc.json` | Custom prompts may contain secrets |
| Conversation History | `src/conversations/` | Full conversation may include sensitive content |
| External Integrations | `src/integrations/` | May handle API tokens for external services |

## Rules

- **Never hardcode secrets** in source code — use VS Code's `SecretStorage` API for runtime secrets.
- Telemetry must not log raw user prompts, file contents, or any string that could contain credentials.
- `AgentMemory` must sanitize stored data — strip potential secrets before persisting to `globalState`.
- `ResponseCache` entries expire via TTL — but during their lifetime, they must not be exposed outside the extension.
- `.gitignore` must cover `.env`, `.agentrc.json`, `*.vsix`, `out/`, and `node_modules/`.
- Plugin JSON files (`.agent-plugins/*.json`) must be scanned for embedded secrets.
- External integrations (`src/integrations/external-integrations.ts`) must use `SecretStorage`, not config fields.
- The extension has zero runtime dependencies — no third-party code that might exfiltrate data.

## Checklist

- [ ] Source code scanned for hardcoded secrets (`grep` for API keys, tokens, passwords)
- [ ] No secret patterns found in `src/`
- [ ] `.agentrc.json` scanned for embedded credentials
- [ ] Telemetry verified to not log sensitive user input
- [ ] `AgentMemory` verified to not persist raw secrets
- [ ] `ResponseCache` entries do not expose secrets externally
- [ ] `.gitignore` covers `.env`, `.agentrc.json`, `*.vsix`, `out/`, `node_modules/`
- [ ] Plugin JSON files scanned for embedded secrets
- [ ] Conversation persistence reviewed for secret exposure
- [ ] `SecretStorage` used for any runtime secret management
