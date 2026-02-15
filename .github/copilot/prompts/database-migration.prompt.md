````prompt
---
mode: "agent"
description: "Migrate data persistence — update AgentMemory schema, ResponseCache format, ConversationPersistence, SharedState migration"
---

# Data Persistence Migration

You are a data engineer for the VS Code Agent extension (TypeScript, zero runtime deps). You will migrate the extension's persistence layer — AgentMemory, ResponseCache, ConversationPersistence, and SharedState — all backed by VS Code's `globalState`/`workspaceState`.

## Workflow

1. **Audit current persistence schemas**:
   ```bash
   grep -rn "globalState\|workspaceState\|update\|get" src/memory/ src/cache/ src/conversations/ src/state/
   ```
   - `AgentMemory` (`src/memory/agent-memory.ts`): stores key-value memories with timestamps.
   - `ResponseCache` (`src/cache/response-cache.ts`): LRU cache with TTL for agent responses.
   - `ConversationPersistence` (`src/conversations/`): stores conversation history.
   - `SharedState` (`src/state/`): cross-agent shared data.

2. **Design the new schema**: Define TypeScript interfaces for the new data format. Include a `schemaVersion` field for future migrations.
   ```typescript
   interface MemoryEntryV2 {
     schemaVersion: 2;
     key: string;
     value: unknown;
     createdAt: number;
     updatedAt: number;
     tags: string[];
   }
   ```

3. **Implement migration logic**:
   ```typescript
   async function migrateMemory(state: vscode.Memento): Promise<void> {
     const version = state.get<number>('memorySchemaVersion', 1);
     if (version < 2) {
       const oldData = state.get<OldFormat[]>('memories', []);
       const newData = oldData.map(transformToV2);
       await state.update('memories', newData);
       await state.update('memorySchemaVersion', 2);
     }
   }
   ```

4. **Run migrations on activation**: Call migration functions early in `activate()` before modules read from state.
   ```typescript
   // In src/extension.ts activate()
   await migrateMemory(context.globalState);
   await migrateCache(context.globalState);
   await migrateConversations(context.workspaceState);
   ```

5. **Add rollback capability**: Keep old data under a backup key until the next version.
   ```typescript
   await state.update('memories_backup_v1', oldData);
   ```

6. **Write migration tests**:
   ```typescript
   describe('migrateMemory', () => {
     it('should migrate v1 to v2 format', async () => { /* ... */ });
     it('should be idempotent — running twice is safe', async () => { /* ... */ });
     it('should handle empty state gracefully', async () => { /* ... */ });
     it('should preserve backup of old data', async () => { /* ... */ });
   });
   ```

7. **Validate**:
   ```bash
   npm run compile && npm run lint && npm test
   ```

## Quality Checklist
- [ ] `schemaVersion` field added to all persistence schemas
- [ ] Migration is idempotent — safe to run multiple times
- [ ] Old data backed up before transformation
- [ ] Migration runs before any module reads from state
- [ ] All persistence modules updated to read/write new format
- [ ] Tests cover: fresh install, migration from v1, idempotency, empty state

## Pitfalls to Avoid
- Don't lose existing user data — always back up before migrating
- Don't assume state is populated — handle fresh installs (empty state)
- Don't run migrations after modules initialize — they'll read old format
- Don't use external databases — VS Code `Memento` API only
- Don't forget that `workspaceState` is per-workspace, `globalState` is global
````
