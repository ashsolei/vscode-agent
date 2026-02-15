---
mode: "agent"
description: "Create a new tool for the ToolRegistry — extending the file/search tool pattern with path validation and error handling"
---

# Create a New Tool

Add a new tool to the ToolRegistry in `src/tools/`.

## Tool Architecture

Tools are registered in `src/tools/index.ts` via `ToolRegistry`:
- `FileTool`: read/write/delete files via `AutonomousExecutor` with path validation
- `SearchTool`: workspace search via `vscode.workspace.findFiles`

## Template

```typescript
// src/tools/<name>-tool.ts
import * as vscode from 'vscode';

export interface <Name>ToolParams {
    // tool-specific parameters
}

export class <Name>Tool {
    readonly id = '<name>';
    readonly description = 'Brief description for agent routing';

    async execute(params: <Name>ToolParams): Promise<string> {
        // 1. Validate inputs (especially paths)
        // 2. Perform the operation using VS Code APIs only
        // 3. Return result as string for agent consumption
        // 4. Handle errors with descriptive messages
        try {
            // implementation
            return 'Success: ...';
        } catch (error) {
            return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
```

## Registration

In `src/tools/index.ts`:
```typescript
import { <Name>Tool } from './<name>-tool';

// In ToolRegistry constructor:
this.tools.set('<name>', new <Name>Tool());
```

## Rules

- Tools MUST use VS Code API only — no runtime dependencies
- File tools MUST use `validatePath()` to prevent path traversal
- Tools return strings (results are consumed by agents)
- All errors must be caught and returned as descriptive strings
- Write tests in `src/tools/<name>-tool.test.ts`

## Path Validation

Always validate file paths to prevent directory traversal:
```typescript
import { validatePath } from '../autonomous/executor';

const safePath = validatePath(inputPath, workspaceRoot);
if (!safePath) {
    return 'Error: Path is outside workspace boundary';
}
```
