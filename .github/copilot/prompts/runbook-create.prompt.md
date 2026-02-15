```prompt
---
mode: "agent"
description: "Create operational runbook — for scenarios like extension crash, agent failure, cache corruption, middleware infinite loop"
---

# Create an Operational Runbook

You are an SRE writing a runbook for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents, GuardRails, MiddlewarePipeline).

## Steps

1. **Choose the incident scenario**
   - Extension host crash on activation
   - Specific agent throws unhandled exception
   - `ResponseCache` returns stale or corrupt data
   - `MiddlewarePipeline` infinite loop or hang
   - `AgentMemory` data loss after VS Code update
   - `GuardRails` rollback fails to restore files

2. **Write the runbook using this structure**
   ```markdown
   # Runbook: <Scenario Title>

   ## Symptoms
   - What the user sees (error notification, frozen chat, missing responses).

   ## Diagnosis
   1. Open Output channel → "Agent" to check logs.
   2. Run `Agent: Health Check` command.
   3. [Scenario-specific diagnostic steps.]

   ## Resolution
   1. [Step-by-step fix with exact commands or settings changes.]
   2. Verify fix: `npm run compile && npm test`.

   ## Prevention
   - Describe guardrails, tests, or config that prevents recurrence.

   ## Escalation
   - When to file a GitHub issue vs. attempting a local fix.
   ```

3. **Add diagnostic commands**
   - `Developer: Toggle Developer Tools` → Console tab for stack traces.
   - `grep -rn 'catch' src/middleware/middleware.ts` to verify error isolation.
   - Check `globalState` via `Developer: Open State` if memory corruption is suspected.

4. **Include rollback procedures**
   - For autonomous agent failures: `GuardRails.rollback(checkpointId)`.
   - For cache corruption: clear via `ResponseCache.clear()` or delete workspace state.
   - For config issues: reset `.agentrc.json` to default or delete it.

5. **Verification**
   ```bash
   npm run compile && npm test
   ```

## Quality Checklist
- [ ] Symptoms are described from the user's perspective
- [ ] Each step is copy-pasteable (no vague instructions)
- [ ] Rollback procedure is tested and documented
- [ ] Escalation path is clear
- [ ] Runbook is saved in `docs/runbooks/`

## Pitfalls to Avoid
- Writing runbooks that assume access to production telemetry (this is a local extension).
- Omitting the "Prevention" section — runbooks should reduce future incidents.
- Using internal jargon without defining it (not all responders know `MiddlewarePipeline`).
- Forgetting that VS Code extensions run in a single thread — blocking diagnosis steps may worsen hangs.
```
