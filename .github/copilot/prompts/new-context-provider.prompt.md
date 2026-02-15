---
mode: "agent"
description: "Add a new context provider to the ContextProviderRegistry — inject workspace data (git, diagnostics, files) into agent prompts"
---

# Create a New Context Provider

Add data sources to the ContextProviderRegistry in `src/context/context-providers.ts`.

## Current Providers

The registry injects workspace context into agent prompts:
- **Git diff** — staged/unstaged changes from `git diff`
- **Diagnostics** — errors/warnings from `vscode.languages.getDiagnostics()`
- **Selection** — active editor selection text
- **Dependencies** — `package.json` dependencies summary

## Template

```typescript
// In src/context/context-providers.ts

// Add to ContextProviderRegistry class:
private async provide<Name>(): Promise<string> {
    try {
        // Use VS Code API to gather context
        const data = await vscode.workspace.findFiles('pattern');
        
        if (!data || data.length === 0) {
            return '';
        }

        return `\n## <Name> Context\n${formatData(data)}`;
    } catch {
        return ''; // Context providers must never throw
    }
}
```

## Registration

Add to the `getWorkspaceContext()` method:
```typescript
async getWorkspaceContext(): Promise<string> {
    const parts: string[] = [];
    
    // existing providers...
    parts.push(await this.provideGitDiff());
    parts.push(await this.provideDiagnostics());
    
    // new provider
    parts.push(await this.provide<Name>());
    
    return parts.filter(Boolean).join('\n');
}
```

## Rules

- Context providers MUST NOT throw — always wrap in try/catch returning empty string
- Context MUST be concise — agents have limited context windows
- Use VS Code API only — no external dependencies
- Return empty string when no relevant context exists
- Format output as markdown for readability in prompts
- Keep context under 500 lines to avoid overwhelming agents
