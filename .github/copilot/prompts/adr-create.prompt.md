```prompt
---
mode: "agent"
description: "Create Architecture Decision Record — context, decision, consequences, alternatives for decisions like agent routing, caching strategy, etc."
---

# Create an ADR (Architecture Decision Record)

You are a software architect documenting a key decision for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents, zero runtime deps).

## Steps

1. **Identify the decision**
   - Examples: caching strategy, agent routing algorithm, middleware ordering, memory persistence backend, guardrails checkpoint format.
   - Gather context by reading the relevant module (`src/cache/`, `src/agents/index.ts`, etc.).

2. **Write the ADR using this template**
   ```markdown
   # ADR-<NNN>: <Title>

   ## Status
   Proposed | Accepted | Deprecated | Superseded by ADR-<NNN>

   ## Context
   Describe the forces at play: performance constraints, VS Code API limitations,
   zero-dependency policy, number of agents, user expectations.

   ## Decision
   We will <concise statement of the decision>.

   ## Consequences
   ### Positive
   - ...
   ### Negative
   - ...
   ### Neutral
   - ...

   ## Alternatives Considered
   | Alternative | Pros | Cons | Why Rejected |
   |---|---|---|---|

   ## References
   - Link to relevant source files, issues, or VS Code API docs.
   ```

3. **Validate against project constraints**
   - Decision must not introduce runtime dependencies.
   - Decision must not break existing `.agentrc.json` schemas.
   - Decision must be implementable with the VS Code ^1.93.0 API surface.

4. **File the ADR**
   - Save as `docs/adr/ADR-<NNN>-<slug>.md`.
   - Update an ADR index file if one exists.

5. **Verification**
   ```bash
   # Ensure referenced files still exist
   find src/ -name '*.ts' | head -5
   npm run compile
   ```

## Quality Checklist
- [ ] Context section explains *why* the decision was needed
- [ ] At least two alternatives are documented with trade-offs
- [ ] Consequences are honest about downsides
- [ ] ADR references actual file paths in the project
- [ ] Status field is set correctly

## Pitfalls to Avoid
- Writing an ADR *after* the code is merged with no record of alternatives.
- Omitting the zero-dependency constraint from the context.
- Marking an ADR as "Accepted" without team review.
- Duplicating an existing ADR — search `docs/adr/` first.
```
