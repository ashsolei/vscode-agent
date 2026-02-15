````prompt
---
mode: "agent"
description: "Implement a new feature end-to-end — plan, implement in TypeScript, register, test with Vitest, document"
---

# Implement a New Feature

You are a senior TypeScript engineer on the VS Code Agent extension (VS Code ^1.93.0, zero runtime deps, 30+ agents extending BaseAgent). You will plan, implement, test, and document a feature from scratch.

## Workflow

1. **Scope the feature**: Identify which modules are affected — agents, middleware, context providers, tools, cache, memory, guardrails, workflow engine, or extension.ts wiring.

2. **Design the interface**: Define TypeScript types/interfaces first. Use strict mode, ES2022 target, Node16 module resolution. No runtime dependencies — only `vscode.*` APIs.

3. **Implement the feature**:
   - Place new files in the appropriate `src/<module>/` directory.
   - Export from the module's `index.ts` barrel file.
   - If adding an agent, extend `BaseAgent` and implement `handle(ctx: AgentContext)`.
   - If autonomous, pass `{ isAutonomous: true }` and use `AutonomousExecutor` with `validatePath()`.
   - Swedish for UI strings; English for code identifiers and JSDoc.

4. **Register and wire up** in `src/extension.ts`:
   - Import the new module and instantiate it in `activate()`.
   - If it's a command, add to `package.json` under `contributes.commands`.
   - If it's an agent, add slash command to `chatParticipants[0].commands`.

5. **Write tests** at `src/<module>/<name>.test.ts`:
   - Use Vitest with `describe`, `it`, `expect`, `vi.fn()`, `vi.clearAllMocks()`.
   - Use the centralized mock at `src/__mocks__/vscode.ts`.
   - Cover happy path, error handling, edge cases, and boundary values.

6. **Validate**:
   ```bash
   npm run compile   # Must pass with zero errors
   npm run lint       # ESLint @typescript-eslint/recommended
   npm test           # Vitest — all tests green
   npm run test:coverage  # Verify coverage doesn't regress
   ```

7. **Document**: Update JSDoc (English), add CHANGELOG entry, update README if user-facing.

## Quality Checklist
- [ ] No runtime dependencies added
- [ ] TypeScript strict mode — no `any` unless justified
- [ ] All file operations use `validatePath()` for path traversal prevention
- [ ] Middleware hooks are error-isolated (try/catch per hook)
- [ ] Agent description is meaningful for smart auto-routing
- [ ] Tests cover ≥80% of new code

## Pitfalls to Avoid
- Don't hardcode agent lists — use `agent.isAutonomous` flag
- Don't skip barrel file exports — modules must be importable via `index.ts`
- Don't forget to register commands in both `extension.ts` AND `package.json`
- Don't add packages to `dependencies` — only `devDependencies` allowed
- Don't use non-VS Code APIs for file system or terminal operations
````
