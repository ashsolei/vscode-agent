````prompt
---
mode: "agent"
description: "Take a GitHub issue and implement the full feature — analyze requirements, implement, test, document, close issue"
---

# Feature from GitHub Issue

You are a senior engineer on the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents, zero runtime deps). You will take a GitHub issue and drive it to completion.

## Workflow

1. **Analyze the issue**: Read the issue title, body, labels, and comments. Extract functional requirements, acceptance criteria, and affected modules (agents, middleware, cache, memory, guardrails, workflow, tools, context providers).

2. **Create a branch**:
   ```bash
   git checkout -b feature/<issue-number>-<short-description>
   ```

3. **Plan the implementation**: Identify files to create/modify. Map requirements to modules in `src/`. Check if existing agents, middleware hooks, or context providers can be extended instead of creating new ones.

4. **Implement**: Follow project conventions:
   - Extend `BaseAgent` for new agents; implement `handle(ctx: AgentContext)`.
   - Autonomous agents: `{ isAutonomous: true }`, use `AutonomousExecutor`.
   - Swedish UI strings, English code/JSDoc.
   - No runtime dependencies — `vscode.*` APIs only.
   - Register in `src/extension.ts`, add commands to `package.json`.

5. **Write tests** at `src/<module>/<name>.test.ts`:
   - Vitest with centralized VS Code mock at `src/__mocks__/vscode.ts`.
   - Use `TestAgent` + `makeCtx()` helpers from `registry-extended.test.ts` for agents.
   - Cover acceptance criteria as test cases.

6. **Validate**:
   ```bash
   npm run compile && npm run lint && npm test
   npm run test:coverage
   ```

7. **Document**: Update CHANGELOG.md, README (Swedish), JSDoc (English).

8. **Commit and push**:
   ```bash
   git add -A && git commit -m "feat: <description> (closes #<issue>)"
   git push origin feature/<issue-number>-<short-description>
   ```

9. **Create PR**: Reference the issue, describe changes, list test results.

## Quality Checklist
- [ ] All acceptance criteria from the issue are met
- [ ] No runtime dependencies introduced
- [ ] TypeScript compiles with zero errors in strict mode
- [ ] Tests pass and cover new code ≥80%
- [ ] CHANGELOG updated with the change
- [ ] Commit message references the issue number

## Pitfalls to Avoid
- Don't implement beyond what the issue asks — scope creep wastes time
- Don't forget to register new agents/commands in both `extension.ts` and `package.json`
- Don't skip the lint step — ESLint catches `@typescript-eslint` violations early
- Don't leave `console.log` — use `TelemetryReporter` or `AgentDashboard`
- Don't assume the issue is complete without verifying acceptance criteria
````
