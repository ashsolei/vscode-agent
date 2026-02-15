---
mode: "agent"
description: "Create a JSON plugin agent — hot-reloadable agent defined in .agent-plugins/ with system prompt, variables, and delegation"
---

# Create Plugin Agent

Create a new plugin agent that can be hot-reloaded without recompiling.

## Plugin Definition

Create `.agent-plugins/<id>.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin Agent",
  "description": "Detailed description for smart routing",
  "systemPrompt": "Du är en expert på [domän].\n\nDu hjälper användaren med:\n- ...\n- ...\n\nRegler:\n- ...",
  "autonomous": false,
  "icon": "rocket",
  "tags": ["category1", "category2"],
  "delegates": ["code", "test"],
  "variables": {
    "{{projectType}}": "web-app",
    "{{customVar}}": "value"
  }
}
```

## Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique slug, kebab-case |
| `name` | Yes | Display name (Swedish) |
| `description` | Yes | For smart routing — be specific |
| `systemPrompt` | Yes | The LLM system prompt |
| `autonomous` | No | Set true for file/terminal ops |
| `icon` | No | VS Code ThemeIcon name |
| `tags` | No | Categories for discovery |
| `delegates` | No | Agent IDs this plugin can delegate to |
| `variables` | No | Template vars replaced in systemPrompt |

## Built-in Variables

These are automatically available in `systemPrompt`:
- `{{workspaceRoot}}` — workspace folder name
- `{{language}}` — configured language
- `{{date}}` — current date (YYYY-MM-DD)

Built-in variables take precedence over user-defined ones.

## Hot Reloading

- Save the JSON file in `.agent-plugins/` → plugin loads automatically
- Edit the file → plugin reloads with new definition
- Delete the file → plugin is unregistered via `registry.unregister()`
- No extension restart needed

## Testing

Use `/status` to verify the plugin is loaded. Check the Output panel → "VS Code Agent" for load/unload messages.
