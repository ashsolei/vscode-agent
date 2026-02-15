```prompt
---
mode: "agent"
description: "Refactor a module safely — identify code smells, extract/consolidate, update imports, verify with tests, no breaking changes"
---

# Refactor a Module

You are a refactoring specialist for the VS Code Agent extension (TypeScript strict, ES2022, zero runtime deps).

## Steps

1. **Identify the target module**
   - Ask which module (e.g., `src/middleware/`, `src/agents/`, `src/guardrails/`).
   - Read all files in the module and its barrel `index.ts`.

2. **Detect code smells**
   - Duplicated logic across agent files (copy-paste `handle()` patterns).
   - God classes (files > 200 lines with mixed responsibilities).
   - Barrel files re-exporting too many internals.
   - Unused exports: `grep -rn 'import.*from.*/<module>/' src/ | sort | uniq -c | sort -rn`.

3. **Plan the refactor**
   - Extract shared logic into helpers (e.g., common prompt-building, error formatting).
   - Consolidate related types into a single types file.
   - Keep public API surface identical — same exports from `index.ts`.
   - Document the plan before changing code.

4. **Execute**
   - Move/rename files, update all import paths.
   - Run `npm run compile` after each structural change to catch broken imports immediately.
   - Update tests to match new file locations.

5. **Verify no breaking changes**
   - Barrel file exports must be a superset of the original.
   - Agent IDs, constructor signatures, and `handle()` contracts unchanged.
   - Run full suite:
     ```bash
     npm run compile && npm test && npm run lint
     ```

## Quality Checklist
- [ ] No new runtime dependencies introduced
- [ ] All imports resolve after refactor (`npm run compile` clean)
- [ ] Test count unchanged or increased
- [ ] No agent IDs or slash commands altered
- [ ] CHANGELOG.md updated if public API touched

## Pitfalls to Avoid
- Extracting a helper that only one agent uses — premature abstraction.
- Changing `BaseAgent` constructor signature without updating all 30+ agents.
- Moving files without updating test imports (tests live alongside source).
- Breaking `PluginLoader` by renaming exported symbols that plugins reference.
```
