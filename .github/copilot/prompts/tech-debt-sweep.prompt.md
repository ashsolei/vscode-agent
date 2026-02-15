```prompt
---
mode: "agent"
description: "Sweep for technical debt — dead code, deprecated APIs, TODO comments, unused agents, copy-paste duplication in agent files"
---

# Tech Debt Sweep

You are a codebase-health engineer for the VS Code Agent extension (TypeScript strict, 30+ agents, zero runtime deps).

## Steps

1. **Dead code detection**
   - Find unexported functions: `grep -rn 'function ' src/ --include='*.ts' | grep -v 'export'`.
   - Cross-reference with imports to confirm they are truly unused.
   - Check for agents registered in `src/extension.ts` but never routed to (`smartRoute` descriptions may have drifted).

2. **Deprecated VS Code API usage**
   - Search for deprecated API patterns:
     ```bash
     grep -rn 'createTerminal\|createOutputChannel' src/ --include='*.ts'
     ```
   - Compare against VS Code ^1.93.0 API release notes for deprecations.

3. **TODO / FIXME / HACK inventory**
   - Collect all markers: `grep -rn 'TODO\|FIXME\|HACK\|XXX' src/ --include='*.ts'`.
   - Categorise by severity: blocking, tech-debt, nice-to-have.
   - Create issues or fix inline for items older than 3 months (check `git log -1 --format=%ai -- <file>`).

4. **Agent duplication analysis**
   - Compare `handle()` method bodies across all 30+ agents in `src/agents/`.
   - Extract shared prompt-building, error-handling, or follow-up patterns into `BaseAgent` helpers.
   - Flag agents with identical logic that could be merged or parameterised.

5. **Unused dependencies**
   - Verify every `devDependencies` entry in `package.json` is referenced (no runtime deps allowed).
   - Remove unused entries: `npx depcheck --skip-missing 2>/dev/null || true`.

6. **Verification**
   ```bash
   npm run compile && npm test && npm run lint
   ```

## Quality Checklist
- [ ] No dead exports remain in barrel files
- [ ] Zero deprecated API calls without a migration plan
- [ ] TODO count reduced or each has a linked issue
- [ ] Agent duplication reduced by ≥ 20%
- [ ] `devDependencies` trimmed to actually-used packages

## Pitfalls to Avoid
- Removing code that is only used by plugins loaded at runtime via `PluginLoader`.
- Deleting an agent that is referenced in `.agentrc.json` workflow definitions.
- Over-abstracting agent logic — some duplication is acceptable for readability.
- Running `depcheck` without understanding that VS Code API is provided at runtime, not via npm.
```
