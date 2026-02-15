---
mode: "agent"
description: "Run a full security audit — check path traversal, injection, secrets, plugin safety, and autonomous agent guardrails"
---

# Security Review

Perform a comprehensive security audit of the VS Code Agent extension.

## Audit Areas

### 1. Path Traversal
- Search for all `Uri.joinPath()` calls — each must be preceded by `validatePath()`
- Check `AutonomousExecutor` methods: `createFile`, `readFile`, `editFile`, `deleteFile`, `openFile`, `listDir`
- Check `FileTool.readFile()` and `FileTool.listFiles()`
- Verify `validatePath()` rejects: `../`, absolute paths, null bytes
- Verify `runCommand()` validates `cwd` stays within workspace

### 2. Input Sanitization
- Check `JSON.parse()` calls have try/catch
- Check plugin JSON validation in `PluginLoader.loadPlugin()`
- Check `.agentrc.json` schema validation in `ConfigManager`
- Verify smart routing doesn't execute arbitrary agent IDs from user input

### 3. Secrets & Data
- No API keys or secrets in `.agentrc.json`
- No sensitive data in telemetry logs
- No user prompts logged with personally identifiable information
- `globalState` doesn't store plaintext credentials

### 4. Autonomous Agent Safety
- All autonomous agents have `isAutonomous: true`
- GuardRails creates checkpoints before autonomous operations
- Dry-run mode prevents unintended changes
- Rollback properly restores file snapshots

### 5. Extension Security
- No `eval()`, `Function()`, or `new Function()` calls
- No dynamic `import()` of user-provided paths
- No `child_process.exec()` with unsanitized input
- WebView content security policy is set

## Output Format

For each finding:
- **Severity**: Critical / High / Medium / Low
- **Location**: File path and line number
- **Description**: What the vulnerability is
- **Fix**: Recommended remediation
