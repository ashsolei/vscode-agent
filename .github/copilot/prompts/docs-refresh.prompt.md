````prompt
---
mode: "agent"
description: "Refresh all documentation — README (Swedish), JSDoc (English), copilot-instructions.md, walkthrough guides, CHANGELOG"
---

# Documentation Refresh

You are a technical writer for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents, Swedish UI strings, English code). You will audit and refresh all project documentation.

## Workflow

1. **Audit existing docs**:
   ```bash
   cat README.md
   cat CHANGELOG.md
   cat .github/copilot-instructions.md
   ls media/walkthrough/
   cat media/walkthrough/step*.md
   ```

2. **Refresh README.md** (Swedish):
   - Update feature list to reflect all 30+ registered agents.
   - Verify installation instructions are current.
   - Update configuration section with all `.agentrc.json` options.
   - Ensure badges (build status, version, license) are correct.
   - Add/update screenshots or GIFs showing the Chat Participant.

3. **Update JSDoc** (English) across source files:
   - All public classes, methods, and interfaces must have JSDoc.
   - Verify `@param`, `@returns`, `@throws`, `@example` tags are accurate.
   ```bash
   # Find public members missing JSDoc
   grep -rn "export class\|export interface\|export function\|export async" src/ | head -30
   ```

4. **Refresh `copilot-instructions.md`**:
   - Update the agent list and module table.
   - Verify architecture diagrams match current code.
   - Update development workflow commands.
   - Ensure constraints section reflects current rules.

5. **Update walkthrough guides** in `media/walkthrough/`:
   - `step1.md` through `step6.md` — verify each step works.
   - Add new steps if features have been added since last update.
   - Ensure steps reference correct commands and UI elements.

6. **Update CHANGELOG.md**:
   - Add entries for all unreleased changes.
   - Follow Keep a Changelog format: Added, Changed, Fixed, Removed.
   - Reference PR/issue numbers where applicable.

7. **Validate links and references**:
   ```bash
   # Check for broken internal links
   grep -rn "\[.*\](.*\.md)" *.md .github/ media/ | head -20
   npm run compile  # Ensure JSDoc doesn't reference deleted symbols
   ```

## Quality Checklist
- [ ] README is in Swedish, accurate, and up to date
- [ ] All public APIs have JSDoc in English
- [ ] `copilot-instructions.md` matches current architecture
- [ ] Walkthrough steps are testable and current
- [ ] CHANGELOG follows Keep a Changelog format
- [ ] No broken internal links
- [ ] No references to removed agents, commands, or config options

## Pitfalls to Avoid
- Don't write README in English — project convention is Swedish for UI/docs
- Don't write JSDoc in Swedish — code documentation is in English
- Don't document features that don't exist yet
- Don't remove CHANGELOG entries for past versions
- Don't update `copilot-instructions.md` without verifying against actual code
- Don't forget the walkthrough guides — they're user-facing onboarding
````
