---
name: "Event-Driven Agents"
description: "Configure event-driven agent triggers — automatically run agents on file save, diagnostics, editor open/close, and custom events"
argument-hint: "What event trigger? e.g. 'lint on save' or 'auto-fix errors' or 'review on file open'"
---

# Event-Driven Agents Skill

Set up agents that trigger automatically on VS Code events using the `EventDrivenEngine` in `src/events/event-engine.ts`.

## Architecture

The `EventDrivenEngine`:
1. Listens to VS Code workspace/editor events
2. Matches events against rules defined in `.agentrc.json`
3. Dispatches matching events to the specified agent
4. Supports debouncing to avoid excessive triggering

## Event Types

| Event | Trigger | Available Data |
|---|---|---|
| `onSave` | File saved | URI, language ID, file content |
| `onDiagnostic` | New diagnostics | URI, diagnostics array, severity |
| `onOpen` | File opened | URI, language ID |
| `onClose` | File closed | URI |

## Event Rules Configuration

In `.agentrc.json`:
```json
{
    "eventRules": [
        {
            "event": "onSave",
            "pattern": "**/*.ts",
            "agentId": "review",
            "prompt": "Quick review: check for common TypeScript issues",
            "debounceMs": 2000
        },
        {
            "event": "onDiagnostic",
            "severity": "error",
            "agentId": "autofix",
            "prompt": "Automatically fix this error if possible",
            "debounceMs": 5000
        },
        {
            "event": "onSave",
            "pattern": "**/*.test.ts",
            "agentId": "test",
            "prompt": "Verify test file follows project patterns",
            "debounceMs": 3000
        },
        {
            "event": "onOpen",
            "pattern": "src/agents/**/*.ts",
            "agentId": "explain",
            "prompt": "Brief explanation of this agent"
        }
    ]
}
```

## Event Rule Schema

```typescript
interface EventRule {
    event: 'onSave' | 'onDiagnostic' | 'onOpen' | 'onClose';
    pattern?: string;      // glob pattern to match files (optional)
    severity?: string;     // for onDiagnostic: 'error' | 'warning' | 'info'
    agentId: string;       // agent to trigger
    prompt: string;        // prompt to send to the agent
    debounceMs?: number;   // debounce delay in ms (default: 1000)
}
```

## Examples

### Auto-lint on Save
```json
{
    "event": "onSave",
    "pattern": "src/**/*.ts",
    "agentId": "review",
    "prompt": "Check this file for lint issues: formatting, unused imports, type safety",
    "debounceMs": 2000
}
```

### Auto-fix Errors
```json
{
    "event": "onDiagnostic",
    "severity": "error",
    "agentId": "autofix",
    "prompt": "Fix this TypeScript error",
    "debounceMs": 5000
}
```

### Document on Open
```json
{
    "event": "onOpen",
    "pattern": "src/**/*.ts",
    "agentId": "explain",
    "prompt": "Show a brief summary of this file's purpose and key exports"
}
```

### Security Check on Test Save
```json
{
    "event": "onSave",
    "pattern": "src/autonomous/**/*.ts",
    "agentId": "security",
    "prompt": "Verify path validation and input sanitization in this file",
    "debounceMs": 3000
}
```

## Debouncing

Debouncing prevents excessive agent triggers:
- Default: 1000ms
- Saves: 2000-3000ms recommended (files save frequently)
- Diagnostics: 5000ms recommended (diagnostics update rapidly)
- Opens: 0ms or no debounce (files open infrequently)

## Rules

- Event rules only trigger for registered, non-disabled agents
- Autonomous agents triggered by events still get GuardRails checkpoints
- Rate limiting applies to event-triggered agent calls
- Debounce is per-rule, not per-agent
- Event rules are reloaded when `.agentrc.json` changes
- Keep event prompts focused and short — they run automatically
