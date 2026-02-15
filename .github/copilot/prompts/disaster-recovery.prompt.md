```prompt
---
mode: "agent"
description: "Disaster recovery — restore from GuardRails checkpoints, recover corrupted AgentMemory, rebuild cache, re-register agents"
---

# Disaster Recovery

You are a reliability engineer restoring the VS Code Agent extension after a catastrophic failure (TypeScript, VS Code ^1.93.0, GuardRails, AgentMemory, ResponseCache).

## Steps

1. **Assess the damage**
   - Identify what is broken: workspace files, extension state, agent registrations, or all of the above.
   - Check if the extension activates: open any `.ts` file and type `@agent` in the chat.
   - If it does not activate, check `Developer: Toggle Developer Tools` → Console for activation errors.

2. **Restore workspace files from GuardRails**
   - List available checkpoints: review `GuardRails` checkpoint storage in workspace state.
   - Identify the last-known-good checkpoint before the incident.
   - Rollback: call `GuardRails.rollback(checkpointId)`.
   - Verify restored files match expectations:
     ```bash
     git diff --stat
     ```

3. **Recover corrupted AgentMemory**
   - Memory is persisted in `context.globalState`.
   - If corrupted, clear it: `context.globalState.update('agentMemory', undefined)`.
   - Re-seed essential memories by running key prompts through agents.
   - Verify: `memory.search('test')` returns sane results.

4. **Rebuild ResponseCache**
   - Cache is in-memory (LRU) — a restart clears it automatically.
   - If the cache is serving bad data without a restart, call `ResponseCache.clear()`.
   - Warm the cache by re-running common queries.

5. **Re-register agents**
   - If `AgentRegistry` is in a bad state, reload the window (`Developer: Reload Window`).
   - The `activate()` function in `src/extension.ts` re-registers all agents on startup.
   - Verify with `Agent: Health Check`.
   - If a plugin agent is missing, check `.agent-plugins/*.json` files are valid JSON.

6. **Verify full recovery**
   ```bash
   npm run compile && npm test
   # Manual: send a test prompt to @agent and confirm response
   ```

## Quality Checklist
- [ ] All workspace files restored to a consistent state
- [ ] AgentMemory is functional (remember/recall/search work)
- [ ] Cache is cleared and serving fresh responses
- [ ] All 30+ agents registered and routable
- [ ] Health Check passes

## Pitfalls to Avoid
- Rolling back to a checkpoint that predates important intentional changes.
- Clearing `globalState` entirely — it stores more than just AgentMemory.
- Assuming `Reload Window` fixes state corruption — some state persists across reloads.
- Not verifying that `.agentrc.json` is valid JSON after restoring files.
```
