---
name: "Capability Registry"
description: "Maintain the living CAPABILITY-REGISTRY.md: add/remove entries, update model routing table, track provider status, capability adoption workflow"
argument-hint: "Capability to add/update"
---

# Capability Registry

Maintain `CAPABILITY-REGISTRY.md` as the living inventory of AI capabilities available to the VS Code Agent extension. Covers adding, updating, removing entries, model routing table maintenance, and provider status tracking.

## Workflow

1. **Discover** a new capability — via `ai-capability-discovery` skill or manual identification.
2. **Draft** an entry — provider, status, integration point, priority score.
3. **Add** to `CAPABILITY-REGISTRY.md` in the correct section.
4. **Update** the model routing table if the capability affects `ModelSelector` (`src/models/model-selector.ts`).
5. **Track** adoption status — move through: Discovered → Evaluating → Adopting → Adopted.
6. **Review** periodically — prune declined/deprecated entries, update provider status.
7. **Sync** with `.agentrc.json` `models` config when routing changes.

## Templates

### CAPABILITY-REGISTRY.md entry format

```markdown
### [Capability Name]
| Field            | Value                                      |
|------------------|--------------------------------------------|
| Provider         | Copilot / Claude / GPT / Gemini / Local    |
| Status           | Discovered / Evaluating / Adopting / Adopted / Declined / Deprecated |
| Discovered       | 2026-02-15                                 |
| Priority Score   | XX/125 (Impact × Effort × Alignment)       |
| Integration Point| ModelSelector / MiddlewarePipeline / ToolRegistry / SystemPrompts |
| Relevant Agents  | code, review, architect, ...               |
| Notes            | Brief description and context              |
```

### Model routing table section

```markdown
## Model Routing Table
| Agent       | Primary Model          | Fallback Model        | Rationale              |
|-------------|------------------------|----------------------|------------------------|
| code        | copilot/gpt-4o         | claude/sonnet        | Balanced cost/quality  |
| review      | claude/sonnet          | copilot/gpt-4o       | Extended thinking      |
| explain     | copilot/gpt-4o-mini    | local/codellama      | Simple task, fast      |
| architect   | claude/sonnet          | copilot/gpt-4o       | Complex reasoning      |
| security    | claude/sonnet          | copilot/gpt-4o       | High-stakes analysis   |
```

### Provider status section

```markdown
## Provider Status
| Provider | Status  | Last Checked | Models Available           | Notes          |
|----------|---------|-------------|----------------------------|----------------|
| Copilot  | Active  | 2026-02-15  | gpt-4o, gpt-4o-mini       | Default        |
| Claude   | Active  | 2026-02-15  | sonnet, haiku              | Via API        |
| GPT      | Active  | 2026-02-15  | gpt-4o, o1, o3            | Direct API     |
| Gemini   | Active  | 2026-02-15  | pro, flash                 | Via API        |
| Local    | Active  | 2026-02-15  | codellama, deepseek-coder  | Ollama         |
```

### Status transition commands

```bash
# After updating CAPABILITY-REGISTRY.md
npm run compile && npm test

# Sync model routing to .agentrc.json
# Manually update .agentrc.json models and agentModels sections
# ConfigManager (src/config/config-manager.ts) auto-reloads via file watcher
```

## Rules

- `CAPABILITY-REGISTRY.md` is the single source of truth for AI capabilities — all changes go here first.
- Every entry must have all fields: Provider, Status, Discovered date, Priority Score, Integration Point, Relevant Agents.
- Status transitions are one-directional: Discovered → Evaluating → Adopting → Adopted. Only exception: any status → Declined or Deprecated.
- Declined entries require a documented rationale — cannot be blank.
- The model routing table must stay in sync with `.agentrc.json` `agentModels` — `ModelSelector` reads from config.
- Provider status must be reviewed monthly — mark unavailable providers as "Degraded" or "Inactive".
- Priority scores use the formula: Impact(1-5) × InverseEffort(1-5) × Alignment(1-5), max 125.
- Integration points reference real modules: `ModelSelector`, `MiddlewarePipeline`, `ToolRegistry`, `SystemPrompts`, `AgentRegistry`.
- All registry updates require: `npm run compile && npm test` to validate no build breakage.
- Use `EVOLUTION-PROTOCOL.md` for changes that affect system architecture.

## Checklist

- [ ] New capability entry drafted with all required fields
- [ ] Entry placed in correct section of `CAPABILITY-REGISTRY.md`
- [ ] Priority score calculated (Impact × Effort × Alignment)
- [ ] Model routing table updated if capability affects model selection
- [ ] `.agentrc.json` synced with routing table changes
- [ ] Provider status section current (checked within last 30 days)
- [ ] Declined/deprecated entries have documented rationale
- [ ] No orphaned entries (all have valid status)
- [ ] `npm run compile && npm test` passes
- [ ] `EVOLUTION-PROTOCOL.md` updated if architectural impact
