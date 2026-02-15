---
mode: "agent"
description: "Upgrade the full agent system — scan for gaps, add new agents/skills, retire obsolete ones, improve orchestration, update CAPABILITY-REGISTRY.md"
---

# Agent System Upgrade

You are a systems architect for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, AgentRegistry, WorkflowEngine, AgentCollaboration, MiddlewarePipeline).

## Steps

1. **Audit current agent inventory**
   - List all agents from `src/agents/index.ts` and `src/extension.ts` registration.
   - For each agent: note its purpose, `isAutonomous` flag, last modification date, test coverage.
   - Cross-reference with `CAPABILITY-REGISTRY.md` — find undocumented agents.
   - Identify agents with overlapping responsibilities (e.g., `code` vs `component` vs `fullstack`).

2. **Identify capability gaps**
   - Review recent user requests and feature issues for unserved needs.
   - Check if emerging patterns need new agents (e.g., AI testing, data pipeline, API mocking).
   - Evaluate if existing agents need new skills (additional prompt capabilities, tool access).
   - Assess `WorkflowEngine` in `src/workflow/workflow-engine.ts` for missing workflow templates.

3. **Plan additions and retirements**
   - New agents: follow `new-agent.prompt.md` workflow for each.
   - Enhanced agents: update prompts in `src/prompts/system-prompts.ts` or agent files.
   - Retired agents: use `registry.unregister()`, remove slash command from `package.json`.
   - Document rationale for each change.

4. **Improve orchestration**
   - Review `AgentCollaboration` in `src/collaboration/agent-collaboration.ts` — add new voting/debate patterns if needed.
   - Update `WorkflowEngine` with new multi-agent pipelines.
   - Improve `smartRoute()` in `AgentRegistry` for better auto-routing with new agents.
   - Verify `ModelSelector` assigns optimal models for new/changed agents.

5. **Implement and test**
   ```bash
   npm run compile && npm test
   npm run test:coverage
   ```
   - Add tests for new agents in `src/agents/<name>.test.ts`.
   - Verify all agent registrations resolve correctly.
   - Test workflow pipelines with new agent combinations.

6. **Update documentation**
   - Refresh `CAPABILITY-REGISTRY.md` with full agent inventory.
   - Update `package.json` slash commands.
   - Update `CHANGELOG.md` with all additions, changes, retirements.
   - Update `copilot-instructions.md` if architecture changed.

## Quality Checklist
- [ ] Every agent has a documented purpose and test file
- [ ] No overlapping agents without clear differentiation
- [ ] Retired agents fully removed (code, registration, slash command, docs)
- [ ] WorkflowEngine templates updated for new agent combinations
- [ ] CAPABILITY-REGISTRY.md reflects the current state exactly
- [ ] `npm run compile && npm test` passes cleanly

## Pitfalls to Avoid
- Adding agents without removing the slash command of retired ones — causes user confusion.
- Creating overlapping agents without updating `smartRoute()` to differentiate them.
- Retiring an agent that is referenced in `WorkflowEngine` pipeline definitions.
- Not updating `copilot-instructions.md` when agent count or architecture changes.
- Skipping test coverage for new agents — follow `registry.test.ts` patterns.
