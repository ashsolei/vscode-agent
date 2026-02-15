# AI Capability Registry

## Purpose
This registry maps all available AI capabilities to agent behaviors in the VS Code Agent extension.
When new capabilities arrive, update this registry — agents adapt via `ModelSelector` and `ConfigManager`.

## Capability Sources (Monitor These)
| Source | URL | Relevant For |
|---|---|---|
| GitHub Copilot Blog | https://github.blog/changelog/ | Chat, agents, skills, MCP |
| VS Code Release Notes | https://code.visualstudio.com/updates | Extension API changes |
| Anthropic Claude | https://docs.anthropic.com/en/docs/about-claude/models | Model capabilities |
| OpenAI | https://platform.openai.com/docs/changelog | GPT features |
| Google Gemini | https://ai.google.dev/gemini-api/docs | Gemini capabilities |
| MCP Registry | https://github.com/modelcontextprotocol/servers | Tool integrations |
| Hugging Face | https://huggingface.co/models | Open-source models |
| Ollama Library | https://ollama.com/library | Local model deployment |

## Active Capabilities

| Capability | Provider | Status | Used By | Implementation |
|---|---|---|---|---|
| Chat Participant API | VS Code | Active | All agents | `vscode.chat.createChatParticipant()` |
| Language Model API | VS Code | Active | All agents | `vscode.lm.selectChatModels()` |
| Agent Mode | Copilot | Active | orchestrator, developer | Autonomous file editing |
| Custom Agents | Copilot | Active | All | `.github/copilot/agents/*.md` |
| Skills | Copilot | Active | All | `.github/skills/*/SKILL.md` |
| Prompt Files | Copilot | Active | All | `.github/copilot/prompts/*.prompt.md` |
| MCP Servers | Copilot | Active | mcp-integrator | External tool integration |
| Vision | Copilot | Active | ux, reviewer | Image analysis in chat |
| Edits Mode | Copilot | Active | developer, refactor | Multi-file editing |
| Smart Routing | Extension | Active | AgentRegistry | `smartRoute()` with LLM |
| Response Caching | Extension | Active | All agents | `ResponseCache` LRU+TTL |
| Middleware Pipeline | Extension | Active | All agents | Before/after/onError hooks |
| GuardRails | Extension | Active | Autonomous agents | Checkpoint/rollback |
| Workflow Engine | Extension | Active | orchestrator | Multi-agent pipelines |
| Agent Collaboration | Extension | Active | All agents | Vote/debate/consensus |
| Plugin System | Extension | Active | PluginLoader | Hot-reload JSON agents |
| Event-Driven Engine | Extension | Active | EventDrivenEngine | onSave/onDiag triggers |
| Agent Memory | Extension | Active | All agents | Persistent remember/recall |
| Context Providers | Extension | Active | All agents | Git/diagnostics/selection |
| Extended Thinking | Claude | Available | planner, architect | Deep reasoning chains |
| Large Context (200K) | Claude | Available | reviewer, docs | Full codebase analysis |
| Tool Use | Claude | Available | developer | Function calling |
| Artifacts | Claude | Available | docs, architect | Structured output |
| Function Calling | GPT | Available | developer, api | Structured tool use |
| Structured Outputs | GPT | Available | All | JSON schema outputs |
| Code Interpreter | GPT | Available | tester, performance | Runtime code execution |
| Multimodal | Gemini | Available | ux, docs | Native multi-modal |
| Long Context (1M) | Gemini | Available | reviewer, architect | Massive codebase analysis |
| Grounding | Gemini | Available | docs | Google Search grounding |
| Local Inference | Ollama/vLLM | Available | local-models | Offline capability |

## Model Routing Table

Routes tasks to optimal model via `ModelSelector` (`src/models/model-selector.ts`).
Configure in `.agentrc.json` under `models`:

| Task Type | Primary | Fallback 1 | Fallback 2 | Reason |
|---|---|---|---|---|
| Code generation | Copilot (gpt-4o) | Claude | GPT-4 | IDE integration |
| Architecture design | Claude | GPT-4 | Gemini | Extended thinking |
| Code review | Claude | Gemini | Copilot | Large context window |
| Quick fixes | Copilot (gpt-4o) | Any | — | Speed + IDE context |
| Security analysis | Claude | GPT-4 | Gemini | Accuracy |
| Documentation | Claude | Gemini | Copilot | Writing quality |
| Planning | Claude | GPT-4 | Gemini | Extended thinking |
| UI/UX review | Gemini | Claude | Copilot Vision | Image understanding |
| Refactoring | Copilot | Claude | GPT-4 | IDE integration |
| Testing | Copilot | Claude | GPT-4 | Codebase context |
| Cost-sensitive | gpt-4o-mini | Copilot | Local (Ollama) | Cost optimization |
| Offline work | Local (Ollama) | — | — | No network required |
| Long analysis | Gemini (1M ctx) | Claude (200K) | GPT-4 (128K) | Context window |

## Capability Adoption Workflow
1. `capability-scanner` agent detects new feature from monitored sources
2. `ai-evolution` agent assesses project relevance and impact
3. If relevant: create/update agent + skill + prompt
4. `agent-tester` validates the integration
5. Update this registry with new capability entry
6. Commit with message: `feat: adopt <capability> from <provider>`

## Extension-Specific Integration Points

All capabilities integrate through these extension modules:

| Module | Path | Integration Role |
|---|---|---|
| `ModelSelector` | `src/models/model-selector.ts` | Routes to correct model per agent |
| `AgentRegistry` | `src/agents/index.ts` | Registers/routes/chains agents |
| `MiddlewarePipeline` | `src/middleware/middleware.ts` | Cross-cutting concerns |
| `ResponseCache` | `src/cache/response-cache.ts` | LRU cache with TTL |
| `ConfigManager` | `src/config/config-manager.ts` | Hot-reload `.agentrc.json` |
| `PluginLoader` | `src/plugins/plugin-loader.ts` | Hot-reload JSON plugin agents |
| `WorkflowEngine` | `src/workflow/workflow-engine.ts` | Multi-agent pipelines |
| `GuardRails` | `src/guardrails/guardrails.ts` | Checkpoint/rollback safety |
| `ContextProviderRegistry` | `src/context/context-providers.ts` | Workspace data injection |
| `EventDrivenEngine` | `src/events/event-engine.ts` | VS Code event triggers |
