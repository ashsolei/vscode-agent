---
name: "Gemini Capability Integration"
description: "Leverage Gemini-specific capabilities: multimodal understanding, 1M+ context, grounding with Google Search, code execution via ModelSelector."
argument-hint: "Gemini capability to integrate"
---

# Gemini Capability Integration

Leverage Gemini-specific capabilities within the VS Code Agent extension. Covers large context windows, multimodal inputs, grounding, and code execution — all through the VS Code Language Model API and `ModelSelector`.

## Workflow

1. **Identify** the Gemini capability needed: large context, multimodal, grounding, or code execution.
2. **Configure** model selection in `.agentrc.json` via the `models` section.
3. **Implement** Gemini-optimized prompts and context strategies.
4. **Route** through `ModelSelector` (`src/models/model-selector.ts`).
5. **Test** with Vitest — mock `vscode.lm.selectChatModels()`.
6. **Validate** — `npm run compile && npm test`.

## ModelSelector Configuration

```json
// .agentrc.json — Gemini model configuration
{
    "models": {
        "architect": { "vendor": "copilot", "family": "gemini-2.0-flash" },
        "explain": { "vendor": "copilot", "family": "gemini-2.0-flash" },
        "fullstack": { "vendor": "copilot", "family": "gemini-2.0-flash" },
        "docgen": { "vendor": "copilot", "family": "gemini-2.0-flash" }
    }
}
```

## Gemini Strengths

| Capability | Benefit for Extension | Best Agents |
|------------|----------------------|-------------|
| 1M+ token context | Full codebase analysis without chunking | `architect`, `fullstack`, `explain` |
| Multimodal | Understand screenshots, diagrams in chat | `a11y`, `component`, `docs` |
| Grounding | Up-to-date API docs, library references | `docs`, `dependency`, `api` |
| Code execution | Validate generated code snippets | `code`, `test`, `debug` |

## Templates

### Large context — full workspace injection

```typescript
// Gemini's large context window allows injecting more workspace context
async function buildGeminiContext(
    contextRegistry: ContextProviderRegistry,
    maxTokens: number = 500_000  // Gemini supports 1M+
): Promise<string> {
    const parts: string[] = [];
    let tokens = 0;

    // With Gemini, we can include much more context
    const providers = ['selection', 'gitDiff', 'diagnostics', 'dependencies'];
    for (const name of providers) {
        const data = await contextRegistry.gather(name);
        const estimated = Math.ceil(data.length / 4);
        if (tokens + estimated <= maxTokens) {
            parts.push(`## ${name}\n${data}`);
            tokens += estimated;
        }
    }
    return parts.join('\n\n');
}
```

### Gemini-optimized prompt structure

```typescript
function buildGeminiPrompt(agentId: string, context: string, prompt: string): string {
    // Gemini benefits from clear markdown section headers
    return [
        `# System\nYou are the "${agentId}" agent. TypeScript strict, zero deps, Swedish UI.`,
        context ? `# Context\n${context}` : '',
        `# Request\n${prompt}`
    ].filter(Boolean).join('\n\n');
}
```

## Rules

- Model access is through `vscode.lm.selectChatModels()` — no direct Gemini API calls.
- `ModelSelector` at `src/models/model-selector.ts` reads `.agentrc.json` for per-agent model config.
- Gemini's large context enables full-workspace analysis — adjust `ContextProviderRegistry` budgets.
- Always handle unavailable Gemini models — fall back to any available model.
- Error messages to users must be in **Swedish**.
- Zero runtime dependencies — no Google AI SDK, no external libraries.

## Checklist

- [ ] `.agentrc.json` `models` section configured with Gemini for appropriate agents
- [ ] `ModelSelector` resolves Gemini models when configured
- [ ] Context budget adjusted for Gemini's large context window
- [ ] Fallback chain: preferred model → Gemini → any available
- [ ] User-facing error messages in Swedish
- [ ] `npm run compile && npm test` passes with model selection tests
