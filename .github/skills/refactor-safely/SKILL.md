---
name: refactor-safely
description: "Refactor code with safety guarantees: pre-refactor validation, incremental changes, automated testing at each step, rollback on failure, and comprehensive before/after comparison."
argument-hint: "[module-or-file] [refactor-type]"
---

# Refactor Safely

This skill ensures refactoring operations maintain correctness at every step. No big-bang rewrites — every change is validated, tested, and reversible.

## Refactor Types

| Type | Risk | Approach |
|---|---|---|
| Rename | Low | Find all usages → rename → verify build + tests |
| Extract function/method | Low | Identify extraction boundary → extract → verify |
| Move file/module | Medium | Update all imports → move → verify |
| Change interface | Medium | Add new interface → migrate callers → remove old |
| Restructure module | High | Plan phases → execute one phase → verify → next |
| Change architecture pattern | High | Strangler fig or parallel run → gradual migration |

## Pre-Refactor Validation

Before ANY refactoring:

1. **Run full test suite** — establish green baseline
2. **Check for uncommitted changes** — commit or stash first
3. **Identify all usages** — find every reference to the target symbol
4. **Map dependencies** — understand what depends on what
5. **Create checkpoint** — `git stash` or `GuardRails.createCheckpoint()`
6. **Estimate blast radius** — how many files will change

```bash
# Pre-refactor checklist commands
npm run compile      # Build succeeds
npm test             # All tests pass
git status           # Working tree clean
git stash push -m "pre-refactor checkpoint"  # OR use GuardRails
```

## Incremental Refactoring Workflow

### Step 1 — Plan the Refactoring

Break the refactoring into atomic steps. Each step must:
- Be independently committable
- Pass all tests after application
- Be revertable via `git revert`

```markdown
## Refactoring Plan: [description]
| Step | Change | Files | Risk | Revertable |
|---|---|---|---|---|
| 1 | Rename internal helper | 2 | Low | Yes |
| 2 | Extract shared utility | 3 | Low | Yes |
| 3 | Update callers | 5 | Medium | Yes |
| 4 | Remove old code | 2 | Low | Yes |
```

### Step 2 — Execute Each Step

For each atomic step:

1. Make the change
2. Run `npm run compile` — must pass
3. Run `npm test` — must pass
4. Run `npm run lint` — must pass
5. Commit with descriptive message

```bash
# After each step:
npm run compile && npm test && npm run lint
git add -A && git commit -m "refactor: [step description]"
```

### Step 3 — Validate After All Steps

After all steps are complete:

1. Run full test suite including integration/e2e
2. Manually verify critical paths
3. Compare before/after metrics (complexity, line count, test coverage)
4. Review the full diff for any unintended changes

### Step 4 — Before/After Comparison

```markdown
## Refactoring Results
| Metric | Before | After | Change |
|---|---|---|---|
| Files changed | - | N | - |
| Lines added | - | N | - |
| Lines removed | - | N | - |
| Cyclomatic complexity | X | Y | -Z% |
| Test coverage | X% | Y% | +Z% |
| Build time | Xs | Ys | -Zs |
| Tests passing | N/N | N/N | ✅ |
```

## Rollback on Failure

If any step fails:

1. **Immediate:** `git revert HEAD` (if committed) or `git checkout -- .` (if not)
2. **Multi-step rollback:** `git revert HEAD~N..HEAD`
3. **Full rollback:** `git stash pop` or `GuardRails.rollback()`
4. **Document failure:** Record why the step failed and what was learned

## Safety Rules

1. **Never refactor without green tests** — if tests are failing, fix them first
2. **Never skip the compile check** — TypeScript catches most refactoring errors
3. **Never combine refactoring with feature work** — refactoring commits are pure refactoring
4. **Never refactor more than one concern at a time** — atomic changes only
5. **Always check all usages** before removing or renaming anything
6. **Always update imports** when moving files
7. **Never force-push** refactoring commits — history must be preserved
8. **Always update documentation** if public APIs change

## Templates

### Commit Message Template

```
refactor(<scope>): <short description>

- What was refactored and why
- No functional changes
- All tests pass
```

### PR/Review Template

```markdown
## Refactoring: [Title]

### Motivation
Why this refactoring is needed.

### Changes
Step-by-step list of what was changed.

### Before/After
Code comparison showing the improvement.

### Verification
- [ ] All tests pass
- [ ] No functional changes
- [ ] Build succeeds
- [ ] Documentation updated
```

## Checklist

- [ ] Pre-refactor test suite is green
- [ ] Checkpoint created (git stash or GuardRails)
- [ ] All usages of target identified
- [ ] Refactoring broken into atomic steps
- [ ] Each step passes compile + test + lint
- [ ] Each step committed separately
- [ ] No unintended changes in final diff
- [ ] Before/after metrics compared
- [ ] Documentation updated if APIs changed
- [ ] Rollback procedure verified

## Capability Dependencies

- **Codebase search** — finding all usages of symbols
- **Tool use** — running build/test commands
- **File editing** — making code changes
- **Terminal access** — executing validation commands

## Evolution Triggers

- Update when new refactoring patterns emerge (e.g., AI-assisted refactoring)
- Update when build/test tooling changes
- Update when new safety mechanisms are added to the agent system

## Model Compatibility

| Model | Suitability | Notes |
|---|---|---|
| Copilot | Excellent | Native IDE integration, inline suggestions |
| Claude | Excellent | Large context for understanding dependencies |
| GPT-4 | Good | Structured planning for complex refactors |
| Gemini | Good | Long context for large module refactors |
| Local models | Fair | Useful for simple rename/extract operations |
