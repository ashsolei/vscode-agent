---
mode: "agent"
description: "Add a new VS Code command — register the command, add to package.json, implement handler, and bind keybinding"
---

# Add VS Code Command

Register a new command in the VS Code Agent extension.

## Steps

1. **Add to `package.json`** under `contributes.commands`:
```json
{
  "command": "vscode-agent.myCommand",
  "title": "Agent: Min Kommandotitel"
}
```

2. **Optionally add a keybinding** under `contributes.keybindings`:
```json
{
  "command": "vscode-agent.myCommand",
  "key": "ctrl+shift+x",
  "mac": "cmd+shift+x"
}
```

3. **Register in `src/extension.ts`**:
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('vscode-agent.myCommand', async () => {
    // Implementation
  })
);
```

4. **Verify**: Run the extension and test via Command Palette (Cmd+Shift+P).

## Naming Conventions

- Command ID: `vscode-agent.<camelCase>`
- Title: `Agent: <Swedish description>`
- Keep titles concise — they appear in Command Palette

## Existing Commands (30)

The extension already has 30 commands including:
- `clearState`, `showState`, `showDashboard`, `showMemory`, `clearMemory`
- `initConfig`, `toggleCodeLens`, `undo`, `refreshTree`
- `createPlugin`, `showModels`, `previewDiff`
- `saveSnippet`, `showSnippets`, `insertSnippet`, `exportSnippets`
- `showNotifications`, `clearNotifications`
- `switchProfile`, `createProfile`, `exportProfile`, `importProfile`
- `showConversations`, `saveConversation`, `newConversation`
- `showAnalytics`, `clearTelemetry`
- `createExternalIssue`, `showMarketplace`, `healthCheck`
