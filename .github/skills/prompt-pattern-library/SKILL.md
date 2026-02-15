---
name: "Prompt Pattern Library"
description: "Curated prompt patterns: chain-of-thought, few-shot, tree-of-thought, ReAct, structured output, role-play. Model compatibility and optimization tips."
argument-hint: "Pattern name or 'all'"
---

# Prompt Pattern Library

Curated collection of prompt engineering patterns for the VS Code Agent extension. Each pattern includes structure, use cases, model compatibility, and integration with `src/prompts/system-prompts.ts`.

## Workflow

1. **Identify** the agent's reasoning requirement — linear, exploratory, iterative, or structured.
2. **Select** a pattern — match requirement to pattern strengths.
3. **Adapt** the template — customize for the agent's domain and Swedish UI text.
4. **Integrate** — add to `src/prompts/system-prompts.ts` or inline in agent's `handle()` method.
5. **Test** — compare output quality against baseline using Vitest snapshot tests.
6. **Document** — note which model families the pattern works best with.

## Patterns

### Chain-of-Thought (CoT)

```
Tänk steg för steg:
1. Identifiera problemet.
2. Analysera möjliga orsaker.
3. Föreslå en lösning med kodexempel.
4. Verifiera att lösningen inte bryter befintliga tester.
```
**Best for:** `debug`, `explain`, `review` agents. **Models:** All.

### Few-Shot

```
Exempel 1: "Skapa en agent" → src/agents/<name>-agent.ts, extends BaseAgent
Exempel 2: "Generera tester" → src/agents/test-agent.ts, handle() implementerad
Nu: "{user_request}"
```
**Best for:** `create-agent`, `scaffold`, `component` agents. **Models:** All.

### Tree-of-Thought (ToT)

```
Utforska tre alternativa lösningar:
Alternativ A: [Approach] — Fördelar: ... — Nackdelar: ...
Alternativ B: [Approach] — Fördelar: ... — Nackdelar: ...
Alternativ C: [Approach] — Fördelar: ... — Nackdelar: ...
Välj det bästa alternativet och motivera valet.
```
**Best for:** `architect`, `planner`, `refactor` agents. **Models:** Premium (GPT-4o, Claude Sonnet).

### ReAct (Reason + Act)

```
Tanke: Jag behöver förstå den aktuella kodstrukturen.
Handling: Läs filen src/agents/index.ts.
Observation: AgentRegistry har metoderna register(), route(), smartRoute().
Tanke: Jag kan utöka route() med ny logik.
Handling: Implementera ändringen.
```
**Best for:** `autofix`, `debug`, `task` agents (autonomous). **Models:** GPT-4o, Claude.

### Structured Output

```
Svara i JSON: { "sammanfattning": "...", "problem": [{"fil": "...", "rad": 0, "allvarlighet": "hög|medel|låg"}], "förbättringar": ["..."] }
```
**Best for:** `review`, `security`, `metrics` agents. **Models:** All.

### Role-Play

```
Du är en senior TypeScript-utvecklare, expert på VS Code-tillägg och vscode.* API.
```
**Best for:** All agents — sets baseline persona. **Models:** All.

## Rules

- System prompts live in `src/prompts/system-prompts.ts` — Swedish for user-facing text.
- Patterns can be composed — e.g., Role-Play + CoT + Structured Output.
- Model compatibility matters — ToT and ReAct need premium models; CoT and Few-Shot work everywhere.
- Prompt length impacts cost and latency — keep system prompts under 500 tokens when possible.
- Test prompt changes with `npm run compile && npm test` — use snapshot tests for output format.
- `ModelSelector` (`src/models/model-selector.ts`) may route to different models — prompts must degrade gracefully.
- Never hardcode model-specific syntax (e.g., Claude XML tags) in shared prompts — use conditional templates.
- Few-shot examples must reflect real project patterns (`BaseAgent`, `AgentRegistry`, `MiddlewarePipeline`).

## Checklist

- [ ] Pattern selected based on agent reasoning requirement
- [ ] Template adapted with Swedish UI text and project-specific context
- [ ] Prompt added to `src/prompts/system-prompts.ts` or agent `handle()` method
- [ ] Model compatibility verified — tested with target model
- [ ] Output quality compared to baseline
- [ ] Prompt length within budget (<500 tokens for system prompts)
- [ ] Graceful degradation tested with cheaper models
- [ ] Snapshot tests added for structured output patterns
- [ ] `npm run compile && npm test` passes
