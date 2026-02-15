---
name: "AI Capability Discovery"
description: "Discover new AI capabilities: monitor Copilot/Claude/GPT/Gemini changelogs, assess project relevance, score adoption priority, update CAPABILITY-REGISTRY.md"
argument-hint: "Provider to scan or 'all'"
---

# AI Capability Discovery

Systematically discover new AI capabilities across providers (Copilot, Claude, GPT, Gemini) and evaluate their relevance to the VS Code Agent extension. Output: scored capability entries for `CAPABILITY-REGISTRY.md`.

## Workflow

1. **Scan** provider changelogs and release notes — Copilot release notes, Anthropic docs, OpenAI changelog, Google AI blog.
2. **Extract** new capabilities — new API features, model upgrades, tool support, context window changes.
3. **Assess** relevance — does it benefit any of the 30+ agents, `MiddlewarePipeline`, `ModelSelector`, or `WorkflowEngine`?
4. **Score** adoption priority — impact (1-5) × effort (1-5 inverted) × alignment (1-5).
5. **Draft** a `CAPABILITY-REGISTRY.md` entry with status, provider, integration notes.
6. **Create** an issue or task for high-priority capabilities.
7. **Update** `EVOLUTION-PROTOCOL.md` if the capability changes system architecture.

## Templates

### Capability assessment template

```markdown
## [Capability Name]
- **Provider:** Copilot / Claude / GPT / Gemini
- **Discovered:** 2026-02-15
- **Status:** Discovered | Evaluating | Adopting | Adopted | Declined
- **Impact Score:** X/5
- **Effort Score:** X/5 (1=high effort, 5=trivial)
- **Alignment Score:** X/5
- **Priority:** (Impact × Effort × Alignment) = XX/125
- **Relevant Agents:** code, review, explain, ...
- **Integration Point:** ModelSelector / MiddlewarePipeline / SystemPrompts / ToolRegistry
- **Notes:** Brief description and rationale
```

### Scanning checklist per provider

```markdown
### Copilot
- [ ] VS Code release notes (monthly)
- [ ] GitHub Copilot changelog
- [ ] `@vscode/copilot-chat` API changes
- [ ] New chat participant features

### Claude
- [ ] Anthropic API changelog
- [ ] New model releases (Sonnet, Opus, Haiku)
- [ ] Extended thinking / tool use updates

### GPT
- [ ] OpenAI API changelog
- [ ] New models (GPT-4o, o1, o3)
- [ ] Function calling / structured output updates

### Gemini
- [ ] Google AI Studio changelog
- [ ] New model releases (Pro, Ultra, Flash)
- [ ] Multimodal / long-context updates
```

### Priority calculation

```
Priority = Impact × InverseEffort × Alignment
  Impact:    How much does this improve agent quality or capability? (1-5)
  Effort:    Inverse of integration difficulty (5=trivial, 1=major refactor)
  Alignment: How well does it fit the extension's architecture? (1-5)
  Threshold: Priority ≥ 50 → immediate action, 25-49 → next sprint, <25 → backlog
```

## Rules

- `CAPABILITY-REGISTRY.md` is the single source of truth for tracked AI capabilities.
- Every discovered capability must have a status: Discovered → Evaluating → Adopting → Adopted or Declined.
- Scanning should happen at least monthly or when a major provider release is announced.
- Relevance assessment must reference specific agents (`src/agents/`) or modules.
- High-priority capabilities (score ≥ 50) require an implementation plan within one sprint.
- Declined capabilities need a rationale — "not relevant" is insufficient.
- `EVOLUTION-PROTOCOL.md` governs architectural changes triggered by new capabilities.
- Zero runtime dependencies — new capabilities must integrate via VS Code API or external services only.
- All integration work follows: `npm run compile && npm test && npm run lint`.

## Checklist

- [ ] All four providers scanned for recent changes
- [ ] New capabilities extracted and documented
- [ ] Impact / Effort / Alignment scored for each capability
- [ ] Priority calculated and threshold applied
- [ ] `CAPABILITY-REGISTRY.md` updated with new entries
- [ ] High-priority items have implementation tasks created
- [ ] Declined items have documented rationale
- [ ] `EVOLUTION-PROTOCOL.md` reviewed if architectural impact detected
- [ ] Team notified of high-priority discoveries
