```prompt
---
mode: "agent"
description: "Incident response workflow — triage extension failures, trace through pipeline, apply GuardRails rollback, write post-mortem"
---

# Incident Response

You are an incident commander triaging a failure in the VS Code Agent extension (TypeScript, VS Code ^1.93.0, GuardRails, MiddlewarePipeline, 30+ agents).

## Steps

1. **Triage — identify impact**
   - Is the entire extension unresponsive, or just one agent?
   - Check the Output channel → "Agent" for error logs.
   - Run `Agent: Health Check` to confirm agent registration state.
   - Determine scope: single user, all users, specific workspace.

2. **Trace through the pipeline**
   - Follow the request flow: `handler()` → `smartRoute()` → `MiddlewarePipeline.execute()` → agent `handle()`.
   - Check `before` hooks — did rate-limiting or validation reject the request?
   - Check `after` hooks — did post-processing corrupt the response?
   - Check `onError` hooks — was the error swallowed silently?
   - Inspect `ResponseCache` — is a cached error being served?

3. **Contain the incident**
   - If an autonomous agent caused file damage: `GuardRails.rollback(checkpointId)`.
   - If cache is serving corrupt data: `ResponseCache.clear()`.
   - If a specific agent is crashing: disable it via `.agentrc.json` → `disabledAgents`.
   - If middleware is looping: restart the Extension Development Host.

4. **Resolve**
   - Fix the root cause in code.
   - Add a regression test covering the failure scenario.
   - Verify:
     ```bash
     npm run compile && npm test
     ```

5. **Post-mortem**
   - Document: timeline, root cause, impact, resolution, lessons learned.
   - Identify missing guardrails — add `onError` middleware or tighten `validatePath()`.
   - Update relevant runbook in `docs/runbooks/`.

## Quality Checklist
- [ ] Impact assessed within first 5 minutes
- [ ] GuardRails rollback applied if autonomous operations caused damage
- [ ] Root cause identified and fixed with a test
- [ ] Post-mortem written and filed
- [ ] Runbook updated to prevent recurrence

## Pitfalls to Avoid
- Restarting VS Code as the first step — you lose the error state in the Output channel.
- Rolling back GuardRails without first noting the checkpoint ID for the post-mortem.
- Blaming `smartRoute()` without checking if the agent ID was correct.
- Skipping the post-mortem for "small" incidents — patterns emerge from accumulated minor failures.
```
