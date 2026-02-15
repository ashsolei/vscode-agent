```prompt
---
mode: "agent"
description: "Generate developer onboarding guide — setup, architecture walkthrough (BaseAgent, AgentRegistry, MiddlewarePipeline), adding agents, debugging"
---

# Onboarding Guide Generator

You are a technical writer creating an onboarding guide for a new developer joining the VS Code Agent extension project (TypeScript, VS Code ^1.93.0, 30+ agents, zero runtime deps, Vitest).

## Steps

1. **Environment setup**
   - Document prerequisites: Node.js, VS Code, Git, Docker (optional).
   - Clone, install, build:
     ```bash
     git clone <repo-url> && cd vscode-agent
     npm install
     npm run compile
     npm test
     ```
   - Explain the dev container option (`Dockerfile`, `.devcontainer/`).

2. **Architecture walkthrough**
   - Describe the request flow: User message → `handler()` → `smartRoute()` → `MiddlewarePipeline` → Agent `handle()` → streamed response.
   - Cover core modules: `BaseAgent`, `AgentRegistry`, `MiddlewarePipeline`, `GuardRails`, `AutonomousExecutor`, `ResponseCache`, `AgentMemory`, `ConfigManager`.
   - Explain the role of `src/extension.ts` as the wiring entry point.

3. **Adding a new agent**
   - Step-by-step: create file, extend `BaseAgent`, register, add slash command, write test.
   - Reference `src/agents/code-agent.ts` as the canonical example.
   - Highlight the Swedish UI strings / English code identifiers convention.

4. **Debugging**
   - Press F5 to launch Extension Development Host.
   - Set breakpoints in agent `handle()` methods.
   - Use `Agent: Health Check` command to verify wiring.
   - Inspect `Output > Agent` channel for middleware timing logs.

5. **Testing**
   - Unit tests: `npm test` (Vitest), co-located `*.test.ts` files.
   - E2E tests: `npm run test:e2e` (@vscode/test-electron).
   - Coverage: `npm run test:coverage`.

6. **Key files to read first**
   - `src/extension.ts`, `src/agents/base-agent.ts`, `src/agents/index.ts`, `src/middleware/middleware.ts`, `package.json`.

## Quality Checklist
- [ ] A new developer can go from clone to running tests in under 10 minutes
- [ ] Architecture diagram or description matches current code
- [ ] All commands and scripts are copy-pasteable and verified
- [ ] Swedish / English convention is explicitly documented

## Pitfalls to Avoid
- Assuming the reader knows the VS Code extension API.
- Referencing deprecated scripts or file paths.
- Omitting the zero-runtime-dependencies constraint (newcomers may `npm install` a library).
- Forgetting to mention `.agentrc.json` for project-level configuration.
```
