---
name: "Copilot Feature Adoption"
description: "Adopt new Copilot features: detection, assessment, agent/prompt/skill creation, testing. Covers chat, edits, agent mode, skills, MCP, vision, workspace indexing."
argument-hint: "Copilot feature name"
---

# Copilot Feature Adoption

Detect and adopt new GitHub Copilot features into the VS Code Agent extension. Covers chat participants, edit mode, agent mode, skills, MCP tool integration, vision capabilities, and workspace indexing.

## Workflow

1. **Detect** — monitor VS Code Insiders releases, Copilot changelog, `@vscode/copilot-chat` API updates.
2. **Assess** — determine relevance to existing agents and whether it enables new agents or skills.
3. **Prototype** — create a minimal integration in a feature branch.
4. **Integrate** — wire into `AgentRegistry` (`src/agents/index.ts`), `ModelSelector` (`src/models/model-selector.ts`), or `ToolRegistry` (`src/tools/index.ts`).
5. **Create** agents/skills/prompts if the feature warrants them.
6. **Test** — unit tests with Vitest, manual testing via `F5` launch.
7. **Document** — update `CAPABILITY-REGISTRY.md` and relevant skill files.

## Templates

### Chat participant feature adoption

```typescript
// In src/extension.ts — register new participant capabilities
const participant = vscode.chat.createChatParticipant('agent', handler);
participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
// New: leverage followup provider for richer UX
participant.followupProvider = {
    provideFollowups(result, context, token) {
        return result.metadata?.followUps ?? [];
    }
};
```

### Skill file for new Copilot feature

```markdown
# .github/skills/<feature-name>/SKILL.md
---
name: "Feature Name"
description: "What this feature enables for the agent system"
argument-hint: "Usage hint"
---
```

### MCP tool integration

```typescript
// In src/tools/index.ts — ToolRegistry
// Map MCP-provided tools to agent capabilities
registry.register({
    name: 'mcp-tool-name',
    description: 'Tool description for LLM routing',
    execute: async (args) => {
        // Delegate to MCP server
    }
});
```

### Assessment template

```markdown
## Feature: [Name]
- **Source:** VS Code X.Y release / Copilot changelog
- **Type:** Chat / Edit / Agent Mode / Skill / MCP / Vision / Indexing
- **Status/Effort/Value:** None|Partial|Full / Low|Med|High / Low|Med|High
- **Agents affected:** code, review, explain, ...
- **Decision:** Adopt / Defer / Decline — **Rationale:** ...
```

## Rules

- The extension targets VS Code `^1.93.0` — check minimum version for new Copilot APIs.
- All Copilot features must integrate via `vscode.*` namespace — zero runtime dependencies.
- New slash commands go in `package.json` under `chatParticipants[0].commands`.
- Agent registration happens in `src/extension.ts` — follow existing patterns.
- New agents extend `BaseAgent` (`src/agents/base-agent.ts`) and implement `handle(ctx: AgentContext)`.
- Autonomous features must pass `{ isAutonomous: true }` and use `GuardRails` (`src/guardrails/guardrails.ts`).
- Skills live in `.github/skills/<name>/SKILL.md` with valid YAML frontmatter.
- System prompts go in `src/prompts/system-prompts.ts` — Swedish for user-facing text.
- All changes require: `npm run compile && npm test && npm run lint`.
- Update `CAPABILITY-REGISTRY.md` status to "Adopted" after successful integration.

## Checklist

- [ ] New Copilot feature identified and assessed
- [ ] Minimum VS Code version verified (`^1.93.0` compatible)
- [ ] Prototype created in feature branch
- [ ] Integration point identified — `AgentRegistry`, `ToolRegistry`, `ModelSelector`, or `extension.ts`
- [ ] New agent/skill/prompt created if warranted
- [ ] Slash command added to `package.json` if new agent
- [ ] Unit tests written (Vitest, `src/agents/<name>.test.ts`)
- [ ] Manual testing via `F5` launch completed
- [ ] `CAPABILITY-REGISTRY.md` updated
- [ ] `npm run compile && npm test && npm run lint` passes
