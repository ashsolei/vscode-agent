---
name: "Config Setup"
description: "Configure the extension via .agentrc.json — agents, workflows, event rules, models, memory, guardrails, and prompts"
argument-hint: "What to configure? e.g. 'disable certain agents' or 'add a workflow' or 'change default model'"
---

# Config Setup Skill

Configure the VS Code Agent extension using `.agentrc.json` and VS Code settings.

## .agentrc.json Schema

Place `.agentrc.json` in the workspace root. The `ConfigManager` (`src/config/config-manager.ts`) loads it with a file watcher for hot-reload.

```json
{
    "defaultAgent": "code",
    "language": "sv",
    "autoRouter": true,
    "disabledAgents": [],
    "workflows": {},
    "eventRules": [],
    "memory": {},
    "guardrails": {},
    "prompts": {},
    "models": {}
}
```

## Configuration Sections

### Default Agent
```json
{
    "defaultAgent": "code"
}
```
The agent used for unrouted requests. Must be a registered agent ID.
The smart router falls back to this if LLM routing fails.

### Language
```json
{
    "language": "sv"
}
```
Options: `"sv"` (Swedish — default for UI), `"en"` (English), `"auto"` (detect)

### Auto Router
```json
{
    "autoRouter": true
}
```
When `true`, requests without a slash command are routed via LLM-based `smartRoute()`.
When `false`, all unrouted requests go to `defaultAgent`.

### Disabled Agents
```json
{
    "disabledAgents": ["metrics", "translate", "i18n"]
}
```
Agent IDs to disable. They remain registered but won't be routed to.

### Workflows
```json
{
    "workflows": {
        "full-review": {
            "description": "Complete code review pipeline",
            "steps": [
                { "agentId": "review", "prompt": "Code quality review", "pipeOutput": true },
                { "agentId": "security", "prompt": "Security review", "pipeOutput": true },
                { "agentId": "docgen", "prompt": "Generate improvement report" }
            ]
        }
    }
}
```

### Event Rules
```json
{
    "eventRules": [
        {
            "event": "onSave",
            "pattern": "**/*.ts",
            "agentId": "review",
            "prompt": "Quick review of saved changes"
        },
        {
            "event": "onDiagnostic",
            "severity": "error",
            "agentId": "autofix",
            "prompt": "Fix this error"
        }
    ]
}
```

Events: `onSave`, `onDiagnostic`, `onOpen`, `onClose`

### Memory
```json
{
    "memory": {
        "enabled": true,
        "maxEntries": 1000,
        "persistPath": ".agent-memory.json",
        "autoRecall": true
    }
}
```

### Guardrails
```json
{
    "guardrails": {
        "enabled": true,
        "dryRun": false,
        "maxFileChanges": 10,
        "excludePatterns": ["node_modules/**", ".git/**", "*.lock"]
    }
}
```

### Prompts (System Prompt Overrides)
```json
{
    "prompts": {
        "code": "You are an expert TypeScript developer. Always use strict mode.",
        "review": "Focus on security and performance issues."
    }
}
```
Keys are agent IDs. Values override the default system prompt for that agent.

### Models (Per-Agent Model Selection)
```json
{
    "models": {
        "code": { "vendor": "copilot", "family": "gpt-4o" },
        "explain": { "vendor": "copilot", "family": "gpt-4o-mini" },
        "review": { "vendor": "copilot", "family": "gpt-4o" }
    }
}
```

## VS Code Settings

Configured via `Preferences: Open Settings` or `.vscode/settings.json`:

| Setting | Default | Description |
|---|---|---|
| `vscodeAgent.locale` | `"auto"` | UI language: auto, en, sv |
| `vscodeAgent.rateLimitPerMinute` | `30` | Max requests per minute |
| `vscodeAgent.cacheEnabled` | `true` | Enable response cache |
| `vscodeAgent.cacheTTL` | `300000` | Cache TTL in milliseconds |
| `vscodeAgent.enableTelemetry` | `true` | Enable telemetry |
| `vscodeAgent.enableDashboard` | `true` | Enable agent dashboard |

## Hot-Reload

The `ConfigManager` watches `.agentrc.json` for changes:
- Edit → save → new config loaded within 1 second
- Invalid JSON → previous config retained, error logged
- Missing file → defaults applied
- No extension reload needed

## Validation

After editing `.agentrc.json`:
1. Ensure valid JSON syntax
2. Check agent IDs exist (run Health Check command)
3. Verify workflow agent IDs are registered
4. Check event rule patterns are valid globs
5. Run `Agent: Reload Config` command to force reload
