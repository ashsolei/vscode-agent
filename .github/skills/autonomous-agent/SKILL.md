---
name: "Autonomous Agent"
description: "Build an autonomous agent that safely modifies workspace files and runs terminal commands via AutonomousExecutor with GuardRails protection"
argument-hint: "What should the autonomous agent do? e.g. 'Auto-fix lint errors' or 'Scaffold a new module'"
---

# Autonomous Agent Skill

Create agents that can modify files, run commands, and transform the workspace — with safety guardrails.

## Autonomous vs Non-Autonomous

| Aspect | Non-Autonomous | Autonomous |
|---|---|---|
| Constructor | `super('id', 'desc')` | `super('id', 'desc', { isAutonomous: true })` |
| Capabilities | Read-only, LLM responses | File CRUD, terminal commands |
| Safety | No extra checks | GuardRails checkpoint/rollback |
| File access | Via context only | Via AutonomousExecutor |
| Example agents | explain, review, docs | autofix, scaffold, create-agent |

## AutonomousExecutor API

Located in `src/autonomous/executor.ts`:

```typescript
class AutonomousExecutor {
    constructor(private workspaceRoot: string) {}

    // File operations (all use validatePath)
    async readFile(filePath: string): Promise<string>
    async writeFile(filePath: string, content: string): Promise<void>
    async deleteFile(filePath: string): Promise<void>
    async fileExists(filePath: string): Promise<boolean>
    async listDirectory(dirPath: string): Promise<string[]>

    // Terminal operations
    async runCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }>
}
```

### Path Validation

Every file operation validates the path:
```typescript
function validatePath(inputPath: string, workspaceRoot: string): string | null {
    const resolved = path.resolve(workspaceRoot, inputPath);
    // Prevent directory traversal
    if (!resolved.startsWith(workspaceRoot)) {
        return null;
    }
    return resolved;
}
```

## Template: Autonomous Agent

```typescript
import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous/executor';

export class <Name>Agent extends BaseAgent {
    constructor() {
        super('<name>', 'Beskrivning', { isAutonomous: true });
    }

    async handle(ctx: AgentContext): Promise<AgentResult> {
        const { request, stream, token } = ctx;

        if (token.isCancellationRequested) return {};

        // Get workspace root
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            stream.markdown('Inget arbetsområde öppet.');
            return {};
        }

        const executor = new AutonomousExecutor(workspaceRoot);

        // Show progress
        stream.progress('Analyserar...');

        // Use LLM to determine what to do
        const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
        if (!model) {
            stream.markdown('Ingen språkmodell tillgänglig.');
            return {};
        }

        // Example: Read a file, analyze it, write changes
        try {
            const content = await executor.readFile('src/example.ts');
            
            // Ask LLM to transform the content
            const messages = [
                vscode.LanguageModelChatMessage.User(
                    `Transform this code:\n\n${content}\n\nInstruction: ${request.prompt}`
                )
            ];
            
            const response = await model.sendRequest(messages, {}, token);
            let result = '';
            for await (const fragment of response.text) {
                if (token.isCancellationRequested) break;
                result += fragment;
            }

            // Write the result
            await executor.writeFile('src/example.ts', result);
            stream.markdown('✅ Filen har uppdaterats.');

        } catch (error) {
            stream.markdown(`❌ Fel: ${error instanceof Error ? error.message : String(error)}`);
        }

        return { metadata: { agent: '<name>', autonomous: true } };
    }
}
```

## GuardRails Integration

GuardRails automatically creates checkpoints for autonomous agents:

```
User message → resolve agent (isAutonomous: true)
  → GuardRails.createCheckpoint()  ← snapshot of workspace files
  → agent.handle(ctx)             ← agent modifies files
  → if error or user requests:
      GuardRails.rollback()       ← restore from snapshot
```

### Configuration in `.agentrc.json`
```json
{
    "guardrails": {
        "enabled": true,
        "dryRun": false,
        "maxFileChanges": 10,
        "excludePatterns": ["node_modules/**", ".git/**"]
    }
}
```

## Safety Checklist

- [ ] Constructor passes `{ isAutonomous: true }`
- [ ] Uses `AutonomousExecutor` for ALL file operations
- [ ] Never uses raw `fs` module directly
- [ ] Checks `token.isCancellationRequested` before each file operation
- [ ] Handles errors gracefully with user-visible messages
- [ ] Limits scope of changes (don't modify unexpected files)
- [ ] Tests include mock filesystem operations
- [ ] Path traversal attacks are prevented by `validatePath()`
