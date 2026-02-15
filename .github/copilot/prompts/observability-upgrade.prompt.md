````prompt
---
mode: "agent"
description: "Add observability — enhance TelemetryReporter, add structured logging, improve AgentDashboard metrics, add health checks"
---

# Observability Upgrade

You are an SRE-minded engineer on the VS Code Agent extension (TypeScript, VS Code ^1.93.0, zero runtime deps). You will enhance observability across telemetry, logging, dashboard metrics, and health checks.

## Workflow

1. **Audit current observability** in these modules:
   - `src/telemetry/` — `TelemetryReporter` event tracking
   - `src/dashboard/agent-dashboard.ts` — `AgentDashboard` metrics display
   - `src/middleware/middleware.ts` — timing and usage middleware hooks
   - `src/statusbar/` — status bar indicators

2. **Enhance TelemetryReporter**:
   - Add structured event properties: agent ID, latency, cache hit/miss, token usage.
   - Track middleware pipeline duration per stage (before, handle, after).
   - Record GuardRails checkpoint/rollback events.
   - Use `vscode.env.telemetryLevel` to respect user preferences.

3. **Add structured logging**:
   - Create an `OutputChannel` logger at `src/utils/logger.ts`.
   - Log levels: DEBUG, INFO, WARN, ERROR with timestamps.
   - Log agent routing decisions, cache operations, middleware errors.
   - No `console.log` — all output via the `OutputChannel`.

4. **Improve AgentDashboard metrics**:
   - Track per-agent invocation count, average latency, error rate.
   - Track ResponseCache hit rate and eviction count.
   - Track MiddlewarePipeline error isolation events.
   - Display via `WebviewViewProvider` or `TreeDataProvider`.

5. **Add health check command**:
   - Verify all agents registered in `AgentRegistry`.
   - Verify middleware pipeline is wired.
   - Verify cache, memory, and config manager are operational.
   - Report results via `vscode.window.showInformationMessage`.

6. **Validate**:
   ```bash
   npm run compile && npm run lint
   npm test
   npm run test:coverage
   ```

## Quality Checklist
- [ ] No runtime dependencies added — only `vscode.*` APIs
- [ ] Telemetry respects `vscode.env.telemetryLevel`
- [ ] Structured logs use consistent format with timestamps
- [ ] Dashboard metrics update in real-time
- [ ] Health check covers all core modules
- [ ] Tests cover new observability code

## Pitfalls to Avoid
- Don't add external logging libraries — use VS Code `OutputChannel`
- Don't log sensitive data (user prompts, file contents, secrets)
- Don't block the extension activation path with health checks
- Don't forget to dispose `OutputChannel` and `WebviewViewProvider` on deactivation
- Don't ignore middleware error isolation — logging must not crash the pipeline
````
