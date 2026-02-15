---
name: "Context Optimization"
description: "Optimize context windows: ContextProviderRegistry tuning, chunking by module/dependency, compression, caching, cost-aware context selection"
argument-hint: "Context area to optimize"
---

# Context Optimization

Optimize context window usage for the VS Code Agent extension. The `ContextProviderRegistry` injects workspace context (git diff, diagnostics, selection, dependencies) into agent requests — tuning this is critical for quality and cost.

## Workflow

1. **Profile** current context usage — measure token count per provider.
2. **Identify** waste — large diffs, redundant diagnostics, full dependency trees.
3. **Apply** optimization (chunking, compression, filtering, caching).
4. **Validate** — verify agent response quality is maintained or improved.
5. **Test** — `npm run compile && npm test`.

## Context Providers

| Provider | Source | Injected Data | Path |
|----------|--------|---------------|------|
| Git Diff | `git diff` | Changed files and hunks | `src/context/context-providers.ts` |
| Diagnostics | `vscode.languages.getDiagnostics()` | Errors and warnings | `src/context/context-providers.ts` |
| Selection | `vscode.window.activeTextEditor.selection` | Selected code | `src/context/context-providers.ts` |
| Dependencies | `package.json` | Dependency list | `src/context/context-providers.ts` |

## Templates

### Chunking large diffs

```typescript
function chunkGitDiff(diff: string, maxTokens: number): string {
    const files = diff.split(/^diff --git/m).filter(Boolean);
    let result = '';
    let estimatedTokens = 0;

    for (const file of files) {
        const fileTokens = Math.ceil(file.length / 4); // rough estimate
        if (estimatedTokens + fileTokens > maxTokens) break;
        result += `diff --git${file}`;
        estimatedTokens += fileTokens;
    }
    return result || files[0]?.slice(0, maxTokens * 4) || '';
}
```

### Filtering diagnostics by severity

```typescript
function filterDiagnostics(
    diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
    minSeverity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Warning
): string {
    return diagnostics
        .flatMap(([uri, diags]) =>
            diags
                .filter(d => d.severity <= minSeverity)
                .map(d => `${uri.fsPath}:${d.range.start.line + 1}: ${d.message}`)
        )
        .slice(0, 20) // Cap at 20 most relevant
        .join('\n');
}
```

## Rules

- Context is injected via `ctx.workspaceContext` in the `AgentContext` interface.
- `ContextProviderRegistry` is initialized in `src/extension.ts` and shared across all agents.
- Token estimation uses `length / 4` as a rough heuristic — adjust per model via `ModelSelector`.
- Large diffs must be chunked — never inject unbounded `git diff` output.
- Diagnostics should be filtered by severity; info-level diagnostics are noise for most agents.
- Context caching must respect workspace changes — invalidate on file save events.
- All context providers are in `src/context/context-providers.ts`.
- Zero runtime dependencies — no external tokenizer libraries; use heuristic estimation.

## Checklist

- [ ] Context token budget defined per agent or globally
- [ ] Git diff chunked to fit within token budget
- [ ] Diagnostics filtered by severity (Warning+)
- [ ] Selection context truncated for very large selections
- [ ] Context caching implemented with appropriate invalidation
- [ ] Agent-specific priority ordering for context providers
- [ ] Token estimation heuristic validated against actual model limits
- [ ] `npm run compile && npm test` passes after optimization
