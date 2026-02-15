````prompt
---
mode: "agent"
description: "Add a new VS Code command — register in extension.ts, add to package.json, implement handler, add keybinding, write tests"
---

# Add a New Command

You are a VS Code extension developer for the Agent extension (TypeScript, VS Code ^1.93.0, zero runtime deps). You will add a fully wired VS Code command with handler, keybinding, and tests.

## Workflow

1. **Define the command**: Choose an ID following the convention `vscodeAgent.<commandName>` (camelCase). Write a descriptive title in Swedish for the command palette.

2. **Add to `package.json`** under `contributes.commands`:
   ```json
   {
     "command": "vscodeAgent.<commandName>",
     "title": "Agent: <Beskrivning på svenska>"
   }
   ```

3. **Add keybinding** (optional) under `contributes.keybindings`:
   ```json
   {
     "command": "vscodeAgent.<commandName>",
     "key": "ctrl+shift+<key>",
     "mac": "cmd+shift+<key>",
     "when": "editorTextFocus"
   }
   ```

4. **Implement the handler** in `src/extension.ts` inside `activate()`:
   ```typescript
   context.subscriptions.push(
     vscode.commands.registerCommand('vscodeAgent.<commandName>', async () => {
       // Implementation using vscode.* APIs only
       // Use existing modules: registry, cache, memory, config, etc.
     })
   );
   ```

5. **Add menu contributions** (optional) under `contributes.menus`:
   ```json
   {
     "commandPalette": [
       { "command": "vscodeAgent.<commandName>", "when": "true" }
     ]
   }
   ```

6. **Write tests**: Create test in appropriate test file:
   ```typescript
   import { describe, it, expect, vi } from 'vitest';

   describe('vscodeAgent.<commandName>', () => {
     it('should execute without errors', async () => {
       // Test command handler logic
     });

     it('should handle edge cases', async () => {
       // Empty workspace, no active editor, etc.
     });
   });
   ```

7. **Validate**:
   ```bash
   npm run compile   # Verify TS compiles
   npm run lint      # No ESLint violations
   npm test          # All tests pass
   ```

8. **Test manually**: Press `F5` to launch Extension Development Host, open command palette (`Ctrl+Shift+P`), run the command.

## Quality Checklist
- [ ] Command ID follows `vscodeAgent.<camelCase>` convention
- [ ] Title is in Swedish in `package.json`
- [ ] Handler registered in `activate()` and pushed to `context.subscriptions`
- [ ] Keybinding doesn't conflict with existing VS Code shortcuts
- [ ] Handler handles errors gracefully (try/catch, user-facing messages)
- [ ] Tests cover happy path and edge cases
- [ ] Command works when no workspace/editor is open

## Pitfalls to Avoid
- Don't forget to push the disposable to `context.subscriptions`
- Don't use hardcoded strings — use the command ID constant consistently
- Don't skip the `when` clause in keybindings — prevents conflicts
- Don't add runtime dependencies for command implementation
- Don't forget to test with no active editor — many commands assume one exists
````
