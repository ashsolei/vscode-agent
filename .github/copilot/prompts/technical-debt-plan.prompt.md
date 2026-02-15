---
mode: "agent"
description: "Plan technical debt reduction — categorize debt (extension.ts size, agent duplication, missing tests), prioritize, create phased plan"
---

# Technical Debt Reduction Plan

You are a technical debt analyst for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, AgentRegistry, MiddlewarePipeline, GuardRails).

## Steps

1. **Scan for technical debt**
   - Measure `src/extension.ts` size — it wires 30+ agents and is a known bottleneck:
   ```bash
   wc -l src/extension.ts
   grep -c "register" src/extension.ts
   ```
   - Find duplicated code across agents:
   ```bash
   grep -rn "const PROMPT" src/agents/ | wc -l
   grep -rn "async handle" src/agents/ | wc -l
   ```
   - Identify missing tests:
   ```bash
   for f in src/agents/*-agent.ts; do test -f "${f%-agent.ts}.test.ts" || echo "Missing: $f"; done
   ```
   - Check for TODO/FIXME/HACK markers:
   ```bash
   grep -rn "TODO\|FIXME\|HACK" src/ --include="*.ts" | wc -l
   ```

2. **Categorize the debt**
   - **Structural**: `extension.ts` monolith, tight coupling between modules.
   - **Duplication**: repeated prompt patterns, boilerplate in agent `handle()` methods.
   - **Testing**: agents without test files, low coverage modules.
   - **Documentation**: outdated `CAPABILITY-REGISTRY.md`, missing JSDoc.
   - **Configuration**: hardcoded values that should be in `.agentrc.json`.

3. **Prioritize by impact and risk**
   - High priority: debt blocking new features or causing bugs.
   - Medium priority: debt slowing development velocity.
   - Low priority: cosmetic issues, minor inconsistencies.
   - For each item: estimate effort (hours), risk of change, and blast radius.

4. **Create a phased reduction plan**
   - **Phase 1 (Quick wins)**: Fix TODOs, add missing test files, update docs. (1-2 days)
   - **Phase 2 (Refactoring)**: Extract `extension.ts` registration into auto-discovery, deduplicate agent boilerplate into `BaseAgent` helpers. (3-5 days)
   - **Phase 3 (Architecture)**: Modularize extension activation, split agent categories into sub-registries. (1-2 weeks)
   - Each phase must end with: `npm run compile && npm test && npm run lint`.

5. **Implement Phase 1 immediately**
   ```bash
   npm run compile && npm test
   npm run test:coverage
   ```
   - Fix the easiest 5 items to demonstrate progress.
   - Use `GuardRails` checkpoints before large refactors.

6. **Track and report**
   - Add debt metrics to `src/dashboard/agent-dashboard.ts` or a tracking document.
   - Update `CHANGELOG.md` with each phase completion.
   - Schedule Phase 2 and 3 in upcoming sprints.

## Quality Checklist
- [ ] All debt items cataloged with category, effort, and priority
- [ ] Missing test files identified and at least 3 created
- [ ] `extension.ts` complexity measured and reduction plan defined
- [ ] Phase 1 quick wins completed and verified
- [ ] Phased plan with milestones documented
- [ ] `npm run compile && npm test` passes after each phase

## Pitfalls to Avoid
- Trying to fix all debt at once — phased approach prevents regressions.
- Refactoring `extension.ts` without `GuardRails` checkpoints — high-risk change.
- Counting missing test files without creating stubs — track progress concretely.
- Deprioritizing documentation debt — it compounds and slows onboarding.
- Not measuring before and after — improvements must be quantifiable.
