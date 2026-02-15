---
name: "Claude Capability Integration"
description: "Leverage Claude capabilities: extended thinking, XML-structured prompts, 200K context, tool use, vision, citations. Optimized prompt templates."
argument-hint: "Claude capability to integrate"
---

# Claude Capability Integration

Integrate Claude-specific capabilities into the VS Code Agent extension. Covers extended thinking, XML-structured prompts, 200K context window, tool use, vision, and citations — with optimized prompt templates for each agent.

## Workflow

1. **Identify** the Claude capability to integrate — extended thinking, tool use, vision, etc.
2. **Map** to agents — which of the 30+ agents benefit from this capability?
3. **Design** prompts — use XML structure (`<context>`, `<instructions>`, `<examples>`) for Claude-optimized formatting.
4. **Configure** `ModelSelector` (`src/models/model-selector.ts`) — route eligible agents to Claude.
5. **Implement** — update system prompts (`src/prompts/system-prompts.ts`) and agent logic.
6. **Test** — verify quality improvement over baseline with Vitest.
7. **Document** — update `CAPABILITY-REGISTRY.md` with capability status.

## Templates

### XML-structured prompt for Claude

```typescript
// In src/prompts/system-prompts.ts
const claudeCodeReviewPrompt = `
<role>Erfaren kodgranskare för VS Code Agent.</role>
<context>TypeScript, 30+ agenter, noll runtime-deps.</context>
<instructions>
1. Granska för buggar, säkerhet, prestanda.
2. Verifiera projektkonventioner (strict TS, no runtime deps).
3. Ge förbättringsförslag med kodexempel.
</instructions>
<output-format>Sammanfattning, Problem (allvarlighet + rad), Förbättringar.</output-format>`;
```

### Extended thinking configuration

```json
{
  "models": {
    "claude-thinking": {
      "provider": "claude",
      "model": "claude-sonnet-4-20250514",
      "features": ["extended-thinking"],
      "budgetTokens": 10000
    }
  },
  "agentModels": {
    "architect": "claude-thinking",
    "security": "claude-thinking",
    "review": "claude-thinking"
  }
}
```

### Large-context prompt for 200K window

```typescript
const fullContextPrompt = (files: string[]) => `
<codebase>${files.map(f => `<file path="${f.path}">\n${f.content}\n</file>`).join('\n')}</codebase>
<task>Analysera hela kodbasen och identifiera arkitekturella förbättringsmöjligheter.</task>`;
```

### Tool use integration

```typescript
// Claude tool use mapped to ToolRegistry (src/tools/index.ts)
const tools = [
    { name: 'read_file', description: 'Read file contents', input_schema: { type: 'object', properties: { path: { type: 'string' } } } }
];
```

## Rules

- Claude prompts use XML tags (`<role>`, `<context>`, `<instructions>`, `<output-format>`) — this is Claude's preferred structure.
- System prompts in `src/prompts/system-prompts.ts` — Swedish for user-facing text, English for internal structure.
- Extended thinking is reserved for complex agents: `architect`, `security`, `review`, `planner`.
- 200K context is for codebase-wide analysis — do not send full context for simple tasks.
- Tool use definitions must mirror `ToolRegistry` (`src/tools/index.ts`) capabilities.
- `ModelSelector` routes to Claude only when configured in `.agentrc.json` — never hardcode provider.
- Vision capabilities require image data in prompt — validate input before sending.
- Citations improve traceability — enable for `docs`, `explain`, `review` agents.
- Zero runtime dependencies — Claude is accessed via VS Code's language model API or external endpoint.
- All prompt changes require: `npm run compile && npm test`.

## Checklist

- [ ] Claude capability identified and mapped to target agents
- [ ] XML-structured prompts created in `src/prompts/system-prompts.ts`
- [ ] `.agentrc.json` `models` config updated with Claude model entry
- [ ] `ModelSelector` routing configured for target agents
- [ ] Extended thinking enabled only for complex agents
- [ ] Context window usage validated — not exceeding 200K tokens
- [ ] Tool use definitions aligned with `ToolRegistry`
- [ ] Quality comparison: Claude vs baseline for affected agents
- [ ] `CAPABILITY-REGISTRY.md` updated
- [ ] `npm run compile && npm test` passes
