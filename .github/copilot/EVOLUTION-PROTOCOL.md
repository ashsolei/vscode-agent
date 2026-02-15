# Agent System Evolution Protocol

## Purpose
This protocol ensures the VS Code Agent extension's Copilot agent system **never becomes outdated**. When new AI capabilities arrive from any provider, the system detects, assesses, adopts, and integrates them automatically.

## Trigger Conditions

The agent system should self-evolve when:

1. **New AI model or capability** released by any provider (Copilot, Claude, GPT, Gemini, open-source)
2. **New MCP server** available that's relevant to VS Code extension development
3. **Agent performance degradation** — an agent consistently fails or produces suboptimal results
4. **New VS Code / Copilot feature** released (check VS Code release notes monthly)
5. **Project architecture changes** — new modules, agents, or subsystems added to `src/`
6. **Retrospective findings** — improvement opportunities identified after major tasks
7. **New extension API** — `vscode.*` namespace gains relevant new capabilities
8. **Cost optimization opportunity** — a cheaper model achieves equivalent quality

## Evolution Workflow

```
1. DETECT  → Capability Scanner identifies change
2. ASSESS  → AI Evolution agent evaluates relevance and impact
3. PLAN    → Planner creates adoption/modification plan
4. IMPLEMENT → Create/update agents, skills, prompts, registry
5. TEST    → Verification agent validates changes
6. DOCUMENT → Update CAPABILITY-REGISTRY.md, README, changelogs
7. COMMIT  → Clean commit: feat: adopt <capability> from <provider>
```

### Step Details

#### 1. DETECT
Sources to monitor:
- GitHub Copilot blog: https://github.blog/changelog/ (tag: copilot)
- VS Code release notes: https://code.visualstudio.com/updates
- Anthropic changelog: https://docs.anthropic.com/en/docs/about-claude/models
- OpenAI changelog: https://platform.openai.com/docs/changelog
- Google AI updates: https://ai.google.dev/gemini-api/docs
- MCP server registry: https://github.com/modelcontextprotocol/servers

#### 2. ASSESS
Evaluation criteria:
- **Relevance**: Does this capability help with VS Code extension development?
- **Impact**: How much does it improve existing agent workflows?
- **Effort**: How much work to integrate?
- **Risk**: Could integration break existing functionality?
- **Cost**: Does it change the cost profile of operations?

#### 3. PLAN
Output a structured plan:
```markdown
## Adoption Plan: [Capability Name]
- **Provider**: [Provider name]
- **Capability**: [What it does]
- **Impact**: [How it improves the project]
- **Agents affected**: [Which agents to create/update]
- **Skills affected**: [Which skills to create/update]
- **Prompts affected**: [Which prompts to create/update]
- **Risk assessment**: [What could go wrong]
- **Rollback plan**: [How to undo if it fails]
```

#### 4. IMPLEMENT
- New agent: `src/agents/<name>-agent.ts` extending `BaseAgent`
- New Copilot agent: `.github/copilot/agents/<name>.md`
- New skill: `.github/skills/<name>/SKILL.md`
- New prompt: `.github/copilot/prompts/<name>.prompt.md`
- Update `ModelSelector` routing if new model added
- Update `ConfigManager` schema if new config options

#### 5. TEST
- Run `npm run compile && npm run lint && npm test`
- Verify new agent handles basic prompts
- Check existing agents aren't broken
- Validate `package.json` slash commands if modified

#### 6. DOCUMENT
- Update `CAPABILITY-REGISTRY.md` with new capability entry
- Update model routing table if routing changed
- Update `copilot-instructions.md` if architecture changed
- Add entry to `CHANGELOG.md`

#### 7. COMMIT
```bash
git add .github/ src/ package.json
git commit -m "feat: adopt <capability> from <provider>"
```

## Design Principles for Future-Proofing

### Capability Abstraction
Agents reference capabilities, not specific models:
```typescript
// Good — capability-based
const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });

// Also good — config-driven via ModelSelector
const model = await modelSelector.selectForAgent(agentId);
```

### Interface Contracts
Agents declare inputs/outputs via `AgentContext` and `AgentResult`:
```typescript
interface AgentContext {
    request: vscode.ChatRequest;      // input
    chatContext: vscode.ChatContext;   // history
    stream: vscode.ChatResponseStream; // output channel
    token: vscode.CancellationToken;  // cancellation
    workspaceContext?: string;         // injected context
}
```

### Composability
Any agent can be replaced or combined:
- `AgentRegistry.unregister(id)` removes an agent
- `AgentRegistry.register(agent)` adds a new one
- `WorkflowEngine` chains agents in pipelines
- `AgentCollaboration` enables voting/debate/consensus
- `PluginLoader` adds agents via JSON without compilation

### Self-Description
Every component describes what it does:
- Agents have `id`, `description`, `isAutonomous`
- Middleware has `name` and hook contracts
- Config via `.agentrc.json` is fully declarative
- Skills have `name`, `description`, `argument-hint`

### Graceful Degradation
If a capability is unavailable:
- `ModelSelector` falls back to next available model
- `smartRoute()` falls back to `code` agent if LLM routing fails
- Context providers return empty string on error
- Middleware hooks are error-isolated (try/catch per hook)
- Cache serves stale content if refresh fails

### Hot-Swappable
New agents can be added without modifying existing ones:
- `PluginLoader` watches `.agent-plugins/` for JSON files
- `ConfigManager` watches `.agentrc.json` for config changes
- `EventDrivenEngine` rules can be added/removed via config
- Workflows are defined declaratively in `.agentrc.json`

### Observable
Every agent action is logged:
- `TimingMiddleware` logs execution duration
- `UsageTrackingMiddleware` tracks per-agent invocation counts
- `AgentDashboard` provides WebView with usage statistics
- `TelemetryReporter` records events
- Health check command verifies system integrity
