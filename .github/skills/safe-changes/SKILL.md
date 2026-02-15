---
name: "Safe Changes"
description: "Make changes safely using GuardRails checkpoints, incremental commits, automated testing, and rollback procedures"
argument-hint: "What change to make safely"
---

# Safe Changes

Make changes to the VS Code Agent extension safely by leveraging `GuardRails` checkpoints, incremental git commits, automated validation, and proven rollback procedures.

## Workflow

1. **Assess scope** — determine which files will be modified and whether autonomous agents are involved.
2. **Create checkpoint** — call `GuardRails.createCheckpoint(agentId, description, filePaths)` before any mutation.
3. **Make the change** — edit files through `AutonomousExecutor` (which validates paths via `validatePath()`).
4. **Validate** — run `npm run compile && npm run lint && npm test` immediately after the change.
5. **Commit incrementally** — one logical change per commit with a descriptive message.
6. **Verify** — run the full quality gate suite before considering the change complete.
7. **Rollback if needed** — use `GuardRails.rollback(checkpointId)` or `git revert`.

## Templates

### Creating a checkpoint before file changes

```typescript
const checkpoint = await guardrails.createCheckpoint(
  'refactor',
  'Refactoring MiddlewarePipeline to support async hooks',
  ['src/middleware/middleware.ts', 'src/middleware/index.ts']
);
// ... make changes ...
// If something breaks:
await guardrails.rollback(checkpoint.id);
```

### Safe autonomous execution pattern

```typescript
const executor = new AutonomousExecutor(stream);
// validatePath() is called internally — prevents path traversal
await executor.createFile('src/agents/new-agent.ts', content);
// Check results
const log = executor.log; // ActionResult[]
```

### Incremental commit strategy

```bash
git add src/agents/new-agent.ts
git commit -m "feat: add NewAgent extending BaseAgent"

git add src/extension.ts
git commit -m "feat: register NewAgent in extension activation"

git add package.json
git commit -m "feat: add /new slash command to chatParticipants"
```

## Rules

- **Always checkpoint before autonomous operations** — `GuardRails.createCheckpoint()` is mandatory for any agent with `isAutonomous: true`.
- Path traversal is blocked by `AutonomousExecutor.validatePath()` — never bypass this.
- One logical change per commit; never bundle unrelated changes.
- Run `npm run compile` after every file edit to catch type errors immediately.
- The `GuardRails` class keeps up to 50 checkpoints (`MAX_CHECKPOINTS`); prune if needed.
- Dry-run mode should be used for destructive operations when uncertainty is high.
- All file operations go through `AutonomousExecutor` (`src/autonomous/executor.ts`), never raw `fs`.
- Middleware hooks (`before`/`after`/`onError`) are error-isolated — one failing hook won't crash the pipeline.
- Zero runtime dependencies must be maintained after every change.

## Examples

### Dry-run before applying

```typescript
// Preview changes without writing to disk
await guardrails.dryRun(agentId, description, operations);
// Review the diff, then apply for real
```

### Recovering from a bad change

```typescript
// List all checkpoints
const history = guardrails.listCheckpoints();
// Find the one before the breaking change
const target = history.find(cp => cp.description.includes('before refactor'));
// Rollback
await guardrails.rollback(target!.id);
```

## Checklist

- [ ] `GuardRails.createCheckpoint()` called before all mutations
- [ ] `AutonomousExecutor.validatePath()` used for all file operations
- [ ] `npm run compile` passes after each file edit
- [ ] `npm run lint` passes before commit
- [ ] `npm test` passes before push
- [ ] Each commit contains one logical change
- [ ] Rollback procedure tested and documented
- [ ] No raw `fs` calls — all I/O through `AutonomousExecutor`
- [ ] Zero runtime dependencies maintained
- [ ] Checkpoint history reviewed and pruned if > 50
