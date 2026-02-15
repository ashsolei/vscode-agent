---
name: "Input Validation"
description: "Validate all inputs: user prompts, file paths (validatePath), .agentrc.json config, plugin JSON, command arguments. Prevent injection and traversal."
argument-hint: "Input type to validate"
---

# Input Validation

Validate all external inputs to the VS Code Agent extension. Covers user prompts, file paths, configuration files, plugin JSON, and command arguments. Prevent path traversal, injection, and malformed data.

## Workflow

1. **Identify** all input entry points — user prompts, file paths, config files, plugin JSON, commands.
2. **Validate** each input at the boundary before processing.
3. **Sanitize** where needed — strip dangerous patterns, normalize paths.
4. **Reject** invalid inputs with clear error messages.
5. **Test** validation logic with both valid and adversarial inputs.

## Input Entry Points

| Entry Point | Source | Validation |
|-------------|--------|------------|
| User prompt | `AgentContext.request.prompt` | Length check, no control characters |
| File paths | `AutonomousExecutor` operations | `validatePath()` — prevents traversal |
| `.agentrc.json` | `ConfigManager.load()` | JSON parse + `AgentConfig` schema check |
| Plugin JSON | `PluginLoader` from `.agent-plugins/` | JSON parse + schema validation |
| Slash commands | `AgentContext.request.command` | Match against registered agent IDs |
| Workflow prompts | `WorkflowStep.prompt` | Sanitize before passing to LLM |

## Templates

### Path traversal prevention (`src/autonomous/executor.ts`)

```typescript
// AutonomousExecutor.validatePath() — prevents escaping the workspace
private validatePath(relativePath: string, ws: vscode.WorkspaceFolder): vscode.Uri {
  const uri = vscode.Uri.joinPath(ws.uri, relativePath);
  const resolved = uri.fsPath;
  const root = ws.uri.fsPath;
  if (!resolved.startsWith(root + '/') && resolved !== root) {
    throw new Error(`Path '${relativePath}' escapes workspace root`);
  }
  return uri;
}
```

### Config validation in ConfigManager

```typescript
// Safe JSON parsing with fallback
try {
  const raw = await vscode.workspace.fs.readFile(configUri);
  const config: AgentConfig = JSON.parse(Buffer.from(raw).toString('utf8'));
  // Validate required fields and types
  if (config.defaultAgent && typeof config.defaultAgent !== 'string') {
    throw new Error('defaultAgent must be a string');
  }
} catch (e) {
  // Fall back to defaults — never crash on bad config
  return defaultConfig;
}
```

### Slash command validation

```typescript
// AgentRegistry.resolve() only returns registered agents
resolve(ctx: AgentContext): BaseAgent | undefined {
  if (ctx.request.command) {
    return this.agents.get(ctx.request.command) ?? this.defaultAgent;
  }
  return this.defaultAgent;
}
// Unknown commands fall back to the default agent — no injection possible
```

### Plugin JSON validation

```typescript
// PluginLoader must validate .agent-plugins/*.json
// Reject plugins with:
// - Missing required fields (id, name, description)
// - Paths containing '..'
// - Excessively large files (> 1MB)
```

## Adversarial Inputs to Test

```text
# Path traversal attempts
../../etc/passwd
src/../../../etc/hosts
./valid/../../escape

# JSON injection in .agentrc.json
{"defaultAgent": "code\"; rm -rf /; echo \""}

# Oversized prompts
(prompt with > 100,000 characters)

# Control characters in prompts
"prompt with \x00 null bytes and \x1b escape sequences"
```

## Rules

- **All file operations** must go through `AutonomousExecutor.validatePath()` — never construct file URIs manually.
- `ConfigManager` must catch JSON parse errors and fall back to defaults — never crash on bad config.
- Slash commands are validated by `AgentRegistry.resolve()` — unknown commands use the default agent.
- Plugin JSON from `.agent-plugins/` is untrusted external input — validate structure and size.
- User prompts from `request.prompt` should be length-checked before passing to the LLM.
- Workflow templates in `.agentrc.json` must have their `agentId` validated against registered agents.
- `eventRules` file patterns must be validated — reject patterns like `/**/*` that match everything.
- Path validation prevents both `..` traversal and symlink escapes.
- Sanitize all inputs before storing in `AgentMemory` or `ResponseCache`.

## Checklist

- [ ] `AutonomousExecutor.validatePath()` used for all file path inputs
- [ ] `ConfigManager` handles malformed `.agentrc.json` without crashing
- [ ] `PluginLoader` validates plugin JSON structure and size
- [ ] Slash commands resolved only against registered agents
- [ ] User prompt length validated at input boundary
- [ ] Workflow `agentId` fields validated against `AgentRegistry`
- [ ] `eventRules` file patterns validated for scope
- [ ] Path traversal tests written (adversarial `..` patterns)
- [ ] JSON injection tests written for config parsing
- [ ] `npm test` passes with validation tests green
