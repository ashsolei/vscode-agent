---
name: "Create Plugin"
description: "Create a hot-reloadable plugin agent via JSON definition in .agent-plugins/ — no TypeScript compilation required"
argument-hint: "Describe the plugin agent. e.g. 'A Terraform agent that generates HCL configurations'"
---

# Create Plugin Skill

Create a plugin agent that can be hot-reloaded without recompiling the extension.

## Plugin System Architecture

The `PluginLoader` in `src/plugins/plugin-loader.ts`:
1. Watches `.agent-plugins/` directory for `.json` files
2. Parses plugin definitions and creates lightweight agent wrappers
3. Registers them with `AgentRegistry`
4. Hot-reloads on file changes (uses `vscode.workspace.FileSystemWatcher`)
5. Unregisters via `registry.unregister(pluginId)` on file deletion

## Plugin JSON Schema

Create `.agent-plugins/<name>.json`:

```json
{
    "id": "<name>",
    "description": "Beskrivning på svenska for smart routing",
    "systemPrompt": "You are a specialized assistant for <domain>. Your capabilities include:\n- Capability 1\n- Capability 2\n\nRules:\n- Always respond in the context of <domain>\n- Use VS Code workspace files when relevant",
    "model": {
        "vendor": "copilot",
        "family": "gpt-4o"
    },
    "examples": [
        {
            "prompt": "Example user message",
            "description": "What this example demonstrates"
        }
    ],
    "followUps": [
        {
            "prompt": "Suggested follow-up",
            "label": "Button label"
        }
    ],
    "isAutonomous": false
}
```

## Required Fields

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Unique agent identifier (lowercase, no spaces) |
| `description` | string | Swedish description for UI and smart routing |
| `systemPrompt` | string | The system prompt injected before user messages |

## Optional Fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `model.vendor` | string | `"copilot"` | LLM vendor |
| `model.family` | string | `"gpt-4o"` | LLM model family |
| `examples` | array | `[]` | Few-shot examples for the model |
| `followUps` | array | `[]` | Suggested follow-up buttons |
| `isAutonomous` | boolean | `false` | Whether plugin can modify files |

## Example: Terraform Plugin

`.agent-plugins/terraform.json`:
```json
{
    "id": "terraform",
    "description": "Genererar och granskar Terraform HCL-konfigurationer",
    "systemPrompt": "You are a Terraform expert. You help with:\n- Writing HCL configurations\n- Module design and best practices\n- State management\n- Provider configuration\n\nAlways generate valid HCL syntax. Use modules for reusability.",
    "examples": [
        {
            "prompt": "Create an AWS S3 bucket with versioning",
            "description": "Basic resource creation"
        }
    ],
    "followUps": [
        { "prompt": "Add IAM policy for this resource", "label": "Add IAM" },
        { "prompt": "Create a module from this configuration", "label": "Modularize" }
    ]
}
```

## Hot-Reload Behavior

- **Create** plugin file → agent registered and available immediately
- **Modify** plugin file → old agent unregistered, new version registered
- **Delete** plugin file → agent unregistered from AgentRegistry
- No extension reload or recompilation needed

## Testing Plugins

1. Create the JSON file in `.agent-plugins/`
2. Open VS Code Chat and type `@agent /pluginId your prompt`
3. Verify the agent responds with the expected behavior
4. Modify the JSON and verify changes take effect immediately

## Rules

- Plugin IDs must not conflict with built-in agent IDs
- System prompts should be detailed and specific
- Descriptions in Swedish for consistent UI
- Keep JSON valid — syntax errors prevent loading
- Autonomous plugins use `AutonomousExecutor` with all safety checks
