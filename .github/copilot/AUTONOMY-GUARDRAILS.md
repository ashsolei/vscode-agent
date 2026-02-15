# Autonomy Guardrails — Hard Policy

All agents, prompts, and skills in the VS Code Agent extension MUST follow these rules.

## 1. No Placeholders Rule
- Every output must be real, complete, and executable
- No `TODO: fill later`, no `// implement me`, no `<placeholder>`
- No fake commands, paths, or URLs
- If you can't complete something, document why and propose an alternative
- All file paths must reference real project files under `src/`

## 2. Mandatory Quality Gates
Before ANY change is finalized, ALL applicable gates must pass:
- [ ] `npm run compile` succeeds (TypeScript strict mode)
- [ ] `npm run lint` passes (ESLint with @typescript-eslint/recommended)
- [ ] `npm test` passes (all Vitest tests)
- [ ] New tests added for new code (co-located `<name>.test.ts`)
- [ ] No secrets in code or config
- [ ] Documentation updated (README, JSDoc, copilot-instructions.md)
- [ ] `npm run package` succeeds (vsce package --no-dependencies)
- [ ] Docker build succeeds: `docker build -t vscode-agent .`

## 3. Command Validation Policy
- Every command referenced must exist in `package.json` scripts or VS Code commands
- Build: `npm run compile` | Watch: `npm run watch` | Lint: `npm run lint`
- Test: `npm test` | Coverage: `npm run test:coverage` | E2E: `npm run test:e2e`
- Package: `npm run package` | Docker: `docker build -t vscode-agent .`
- No generic commands — all must be project-specific

## 4. Rollback Strategy
- Every change must be revertable via `git revert`
- Autonomous agents use `GuardRails.createCheckpoint()` before modifications
- `GuardRails.rollback()` restores workspace from checkpoint snapshot
- Configure in `.agentrc.json`:
  ```json
  { "guardrails": { "enabled": true, "dryRun": false, "maxFileChanges": 10 } }
  ```

## 5. Security Requirements
- Zero runtime dependencies — extension ships with NO `dependencies`
- All file operations through `AutonomousExecutor` with `validatePath()`
- No `eval()`, `Function()`, or `child_process.exec` with user input
- WebView dashboard must use Content Security Policy
- No secrets in `.agentrc.json` (committed to git)
- Path traversal prevention: all paths validated against workspace root

## 6. Agent Behavioral Rules
- Never overwrite another agent's work without orchestrator approval
- Never skip tests to save time
- Always check `token.isCancellationRequested` in loops
- Agent descriptions in Swedish for UI consistency
- Code identifiers, JSDoc, and types in English
- Log every significant decision with rationale
- Never hardcode agent lists — use `agent.isAutonomous` flag
- Smart routing falls back to `code` agent if LLM routing fails

## 7. Conflict Resolution
- Scope conflicts: the agent that owns the domain wins
- Quality conflicts: the stricter standard wins
- Priority conflicts: the orchestrator decides
- All conflicts are logged with resolution rationale
- Use `AgentCollaboration` for multi-agent voting/debate/consensus

## 8. Cost Controls
- `ResponseCache` (LRU with TTL) prevents duplicate LLM calls
- `RateLimitMiddleware` enforces `vscodeAgent.rateLimitPerMinute` (default: 30)
- `ModelSelector` routes to appropriate model per agent via `.agentrc.json`
- Prefer cheaper/faster models for quick tasks
- Cache context provider results to reduce computation

## 9. Definition of Done
A task is DONE when:
- [ ] All quality gates pass (Section 2)
- [ ] Tests cover the change (co-located `.test.ts` files)
- [ ] Documentation updated (README in Swedish, JSDoc in English)
- [ ] Change committed with descriptive message
- [ ] No temporary files or debug artifacts remain
- [ ] Agent registered in `src/extension.ts` (if new agent)
- [ ] Slash command in `package.json` (if new agent)
- [ ] Rollback procedure documented (if autonomous change)

## 10. Escalation Protocol
When an agent cannot complete a task:
1. Check `GuardRails` checkpoint — rollback if needed
2. Try fallback approach (different model via `ModelSelector`)
3. Document what was attempted and why it failed
4. Stream error message to user via `stream.markdown()`
5. Return `AgentResult` with error metadata
6. Never silently fail — always leave a trail in telemetry

## 11. Extension-Specific Constraints
- **No runtime dependencies** — only `devDependencies`
- **VS Code API only** — all functionality via `vscode.*` namespace
- **TypeScript strict mode** — ES2022 target, Node16 module resolution
- **Activation**: extension activates on chat participant invocation
- **Disposables**: all registrations pushed to `context.subscriptions`
- **Agent registration order**: first registered = default, then `setDefault('code')`
- **Agent ID stability**: IDs referenced in `package.json` and `.agentrc.json`
