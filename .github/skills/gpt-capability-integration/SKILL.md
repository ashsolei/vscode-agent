---
name: "GPT Capability Integration"
description: "Leverage GPT-specific capabilities: function calling, structured outputs, code interpreter. Prompt templates optimized for GPT via ModelSelector."
argument-hint: "GPT capability to integrate"
---

# GPT Capability Integration

Leverage GPT-specific capabilities within the VS Code Agent extension. Covers function calling, structured outputs, optimized prompt templates, and model selection via `ModelSelector` — all through the VS Code Language Model API.

## Workflow

1. **Identify** the GPT capability needed: function calling, structured output, code generation, or reasoning.
2. **Configure** model selection in `.agentrc.json` via the `models` section.
3. **Implement** GPT-optimized prompts using the templates below.
4. **Route** through `ModelSelector` (`src/models/model-selector.ts`).
5. **Test** with Vitest — mock `vscode.lm.selectChatModels()`.
6. **Validate** — `npm run compile && npm test`.

## ModelSelector Configuration

```json
// .agentrc.json — models section
{
    "models": {
        "code": { "vendor": "copilot", "family": "gpt-4o" },
        "review": { "vendor": "copilot", "family": "gpt-4o" },
        "explain": { "vendor": "copilot", "family": "gpt-4o-mini" },
        "translate": { "vendor": "copilot", "family": "gpt-4o-mini" }
    }
}
```

## Templates

### Structured output prompt (JSON mode)

```typescript
const messages = [
    vscode.LanguageModelChatMessage.User(
        `Analyze the following code and return a JSON object with this exact schema:
{
  "issues": [{"line": number, "severity": "error"|"warning"|"info", "message": string}],
  "suggestions": [{"description": string, "code": string}],
  "complexity": number
}

Code to analyze:
\`\`\`typescript
${code}
\`\`\`

Respond ONLY with valid JSON. No markdown, no explanation.`
    )
];

const [model] = await vscode.lm.selectChatModels({
    vendor: 'copilot', family: 'gpt-4o'
});
const response = await model.sendRequest(messages, {}, token);
```

## Rules

- Model access is through `vscode.lm.selectChatModels()` — no direct API calls to OpenAI.
- `ModelSelector` at `src/models/model-selector.ts` reads `.agentrc.json` for per-agent model config.
- GPT-4o is the default family for code-heavy agents; GPT-4o-mini for lightweight tasks.
- Structured output prompts must include explicit schema and "respond ONLY with JSON" instruction.
- Always handle the case where `selectChatModels()` returns an empty array.
- Error messages to users must be in **Swedish** (e.g., "Ingen språkmodell tillgänglig").
- Prompt templates live in `src/prompts/system-prompts.ts`.
- Token limits vary by model — use cost-aware context selection from the `context-optimization` skill.
- Zero runtime dependencies — no OpenAI SDK, no langchain, no external libraries.

## Checklist

- [ ] `.agentrc.json` `models` section configured for target agents
- [ ] `ModelSelector` resolves the correct GPT model family
- [ ] Structured output prompts include explicit JSON schema
- [ ] JSON response parser handles markdown-wrapped code blocks
- [ ] Fallback to default model when preferred model is unavailable
- [ ] Error handling for empty `selectChatModels()` results
- [ ] User-facing error messages in Swedish
- [ ] `npm run compile && npm test` passes with model selection tests
