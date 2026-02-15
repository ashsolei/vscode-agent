---
name: "Security Audit"
description: "Perform a comprehensive security audit of the extension — path traversal, injection, secrets, autonomous safety, and extension sandboxing"
argument-hint: "What to audit? e.g. 'all autonomous agents' or 'the new file tool' or 'full extension'"
---

# Security Audit Skill

Perform security audits for the VS Code Agent extension.

## Security Areas

### 1. Path Traversal Prevention

The `AutonomousExecutor` uses `validatePath()` to prevent directory traversal:

```typescript
// src/autonomous/executor.ts
function validatePath(inputPath: string, workspaceRoot: string): string | null {
    const resolved = path.resolve(workspaceRoot, inputPath);
    if (!resolved.startsWith(workspaceRoot)) {
        return null; // Path escapes workspace - REJECTED
    }
    return resolved;
}
```

**Audit checklist:**
- [ ] All file operations use `validatePath()` before accessing the filesystem
- [ ] Symlink resolution checked (resolved path vs workspace root)
- [ ] No raw `fs.readFile`/`fs.writeFile` calls outside executor
- [ ] `FileTool` passes through `validatePath()` for every operation
- [ ] Terminal commands in executor don't allow shell injection

### 2. Input Sanitization

User prompts flow directly into LLM calls. Check for:
- [ ] No eval() or Function() with user input
- [ ] No template literal injection into system commands
- [ ] Terminal commands properly escaped in `AutonomousExecutor`
- [ ] No SQL-like injection in search/filter operations

### 3. Secrets & Credentials

- [ ] No hardcoded API keys, tokens, or passwords in source
- [ ] No credentials logged via `console.log` or telemetry
- [ ] `.agentrc.json` doesn't contain secrets (it's committed to git)
- [ ] Extension settings don't expose secrets in VS Code UI

### 4. Autonomous Agent Safety

Autonomous agents (`isAutonomous: true`) can modify the workspace. Verify:
- [ ] GuardRails creates checkpoints before autonomous operations
- [ ] `guardrails.dryRun` mode works (no actual changes made)
- [ ] Rollback restores all modified files correctly
- [ ] rate limiting prevents runaway autonomous execution
- [ ] File deletion requires confirmation or is disabled

### 5. Extension Sandboxing

VS Code extensions run in the extension host process:
- [ ] No network calls except to LLM API via `vscode.lm`
- [ ] No child_process.exec except through `AutonomousExecutor`
- [ ] No dynamic require() or import() of user-controlled paths
- [ ] WebView (dashboard) uses proper Content Security Policy
- [ ] No `eval()` anywhere in the codebase

## Files to Audit

| Priority | File | Risk |
|---|---|---|
| HIGH | `src/autonomous/executor.ts` | File CRUD, terminal commands |
| HIGH | `src/tools/index.ts` | FileTool, SearchTool |
| HIGH | `src/guardrails/guardrails.ts` | Checkpoint/rollback integrity |
| MEDIUM | `src/extension.ts` | Handler, agent routing |
| MEDIUM | `src/plugins/plugin-loader.ts` | Dynamic loading from `.agent-plugins/` |
| MEDIUM | `src/dashboard/agent-dashboard.ts` | WebView HTML generation |
| LOW | `src/agents/*.ts` | Individual agent prompt construction |
| LOW | `src/context/context-providers.ts` | Workspace data gathering |

## Common Vulnerabilities in VS Code Extensions

1. **Prototype pollution**: `Object.assign` or spread with untrusted input
2. **ReDoS**: Complex regex on user input (agent descriptions, prompts)
3. **Path traversal**: `../../../etc/passwd` in file operations
4. **Command injection**: Unescaped input in terminal commands
5. **Insecure WebView**: Missing CSP, insecure script sources
6. **Information disclosure**: Logging sensitive workspace data

## Reporting Format

```markdown
## Security Finding: [Title]
- **Severity**: Critical / High / Medium / Low
- **Location**: `src/file.ts:L42`
- **Description**: What the vulnerability is
- **Impact**: What could happen if exploited
- **Recommendation**: How to fix it
- **Code**: Before/after example
```
