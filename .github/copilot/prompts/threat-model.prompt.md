````prompt
---
mode: "agent"
description: "Create a threat model — identify attack surfaces, assess risks, document mitigations for the VS Code Agent extension"
---

# Threat Model

You are a security engineer reviewing the VS Code Agent extension (TypeScript, autonomous agents with file CRUD and terminal access, GuardRails, AutonomousExecutor). You will identify attack surfaces, assess risks, and document mitigations.

## Workflow

1. **Inventory attack surfaces**:
   - **Path traversal**: `AutonomousExecutor` performs file CRUD — does `validatePath()` block `../../etc/passwd`?
   - **Command injection**: Terminal commands via `AutonomousExecutor` — are inputs sanitized?
   - **Prompt injection**: User messages routed to LLM — can adversarial input hijack agent behavior?
   - **Secrets exposure**: `AgentMemory` persists data — could secrets be stored in `globalState`?
   - **Autonomous agent abuse**: Agents with `isAutonomous: true` can modify the workspace — what limits exist?
   - **Plugin loading**: `PluginLoader` reads `.agent-plugins/*.json` — can malicious plugins execute code?
   - **Rate limiting**: `vscodeAgent.rateLimitPerMinute` (default 30) — is it enforceable?

2. **Assess each threat** using STRIDE or DREAD:
   - Likelihood (1-5), Impact (1-5), Risk = Likelihood × Impact.
   - Classify: Critical (≥20), High (15-19), Medium (10-14), Low (<10).

3. **Review existing mitigations**:
   ```bash
   grep -rn "validatePath\|sanitize\|escape\|guard" src/
   grep -rn "isAutonomous" src/agents/ src/guardrails/
   ```

4. **Document gaps and recommendations**:
   - Missing input sanitization for terminal commands.
   - Memory/cache data at rest encryption.
   - Plugin sandboxing or allowlisting.
   - GuardRails dry-run enforcement for destructive operations.

5. **Create threat model document**: Place in `.github/THREAT-MODEL.md` with a table of threats, risk scores, current mitigations, and recommended actions.

6. **Validate mitigations in code**:
   ```bash
   npm run compile && npm test
   npm run lint
   ```

## Quality Checklist
- [ ] All autonomous agents identified and their capabilities mapped
- [ ] Path traversal prevention verified in `AutonomousExecutor` and `FileTool`
- [ ] Prompt injection risks documented with mitigation strategies
- [ ] Plugin loading security reviewed — no arbitrary code execution
- [ ] Secrets in memory/cache reviewed for exposure risk
- [ ] Rate limiting verified as enforced, not just advisory

## Pitfalls to Avoid
- Don't assume `validatePath()` covers all traversal vectors — test edge cases
- Don't ignore prompt injection — LLM-based routing is an attack vector
- Don't treat GuardRails as a security boundary — it's for rollback, not access control
- Don't skip review of `.agentrc.json` — user config can disable guardrails
- Don't forget VS Code's extension sandbox limitations
````
