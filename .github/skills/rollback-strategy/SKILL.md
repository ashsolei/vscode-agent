---
name: "Rollback Strategy"
description: "Define rollback strategies: GuardRails.rollback(), git revert, agent unregistration, config restoration, cache clearing"
argument-hint: "What to roll back"
---

# Rollback Strategy

Define and execute rollback strategies for the VS Code Agent extension. Covers file rollback via `GuardRails`, git-level reverts, agent unregistration, config restoration, and cache clearing.

## Workflow

1. **Identify scope** — determine what needs rollback: files, agents, config, or cache.
2. **Choose strategy** — match the rollback method to the scope (see strategies below).
3. **Execute rollback** — apply the chosen strategy.
4. **Validate** — run `npm run compile && npm test` to confirm the rollback restored a good state.
5. **Document** — record what was rolled back and why.

## Strategies

### 1. File Rollback — `GuardRails.rollback()`

Restores files to their snapshot state at a given checkpoint.

```typescript
// List checkpoints to find the target
const checkpoints = guardrails.listCheckpoints();
const target = checkpoints.find(cp => cp.agentId === 'refactor');

// Rollback restores all file snapshots and removes created files
await guardrails.rollback(target!.id);
```

- Reverts file contents from `FileSnapshot[]` stored in `Checkpoint`.
- Deletes files listed in `Checkpoint.createdFiles`.
- Max 50 checkpoints retained (`MAX_CHECKPOINTS` in `src/guardrails/guardrails.ts`).

### 2. Git Rollback

```bash
# Revert a specific commit
git revert <commit-sha> --no-edit

# Reset to a known good state (destructive — use with care)
git reset --hard <commit-sha>

# Undo the last commit but keep changes staged
git reset --soft HEAD~1
```

### 3. Agent Unregistration

Remove a problematic agent at runtime without restarting:

```typescript
// Unregister by agent ID
const removed = registry.unregister('problematic-agent');
// If it was the default, AgentRegistry auto-selects the next registered agent
```

### 4. Config Restoration

Restore `.agentrc.json` to its previous state:

```typescript
// ConfigManager watches for file changes and reloads automatically
// Simply revert the file — ConfigManager will pick up the change
await guardrails.rollback(configCheckpointId);
// Or restore from git
// git checkout HEAD -- .agentrc.json
```

### 5. Cache Clearing

```typescript
// Clear the ResponseCache entirely
cache.clear();

// Or clear entries for a specific agent
cache.invalidate(agentId);

// AgentMemory can also be pruned
memory.prune();
```

## Rules

- Always prefer `GuardRails.rollback()` over manual file restoration — it handles created files too.
- Create a checkpoint **before** attempting a rollback, in case the rollback itself needs reverting.
- `git revert` is preferred over `git reset --hard` for shared branches.
- After any rollback, run the full quality gate: `npm run compile && npm run lint && npm test`.
- Agent unregistration via `registry.unregister()` is immediate and does not require extension reload.
- `ConfigManager` (`src/config/config-manager.ts`) auto-reloads on `.agentrc.json` changes.
- Cache clearing is safe — `ResponseCache` is an LRU cache with TTL; entries regenerate on next request.

## Checklist

- [ ] Rollback scope identified (files, agent, config, cache, or combination)
- [ ] Correct strategy selected for the scope
- [ ] Pre-rollback checkpoint created as safety net
- [ ] Rollback executed successfully
- [ ] `npm run compile` passes after rollback
- [ ] `npm run lint` passes after rollback
- [ ] `npm test` passes after rollback
- [ ] Rolled-back state documented in commit message or changelog
- [ ] Cache cleared if stale entries might reference rolled-back code
- [ ] No orphaned agent registrations remain
