---
name: "README Standard"
description: "Maintain README standard: Swedish language, emoji headers, feature/command/settings tables, architecture diagram, development instructions"
argument-hint: "README section to update"
---

# README Standard

Maintain the `README.md` for the VS Code Agent extension. The README uses Swedish for user-facing text, emoji section headers, structured tables, and clear development instructions.

## Workflow

1. **Identify** the section to add or update (features, commands, settings, architecture, development).
2. **Follow** the standard format and language conventions below.
3. **Update** tables and diagrams to reflect the current state of the codebase.
4. **Verify** Markdown renders correctly (no broken links, tables, or diagrams).
5. **Validate** — `npm run compile` still succeeds (README is included in VSIX via `vsce package`).

## Section Structure

The README must follow this order:

1. **Title & badges** — extension name, version, VS Code engine, license
2. **🚀 Funktioner** — feature list with descriptions
3. **📋 Kommandon** — table of slash commands from `package.json`
4. **⚙️ Inställningar** — configuration settings table
5. **🏗️ Arkitektur** — architecture overview and request flow diagram
6. **🛠️ Utveckling** — build, test, lint, package commands
7. **📦 Installation** — VSIX install and marketplace instructions
8. **📄 Licens** — MIT license reference

## Templates

### Feature section

```markdown
## 🚀 Funktioner

| Funktion | Beskrivning |
|----------|-------------|
| 30+ specialiserade agenter | Kod, docs, test, refactor, security m.m. |
| Smart auto-routing | Automatisk agentval via `smartRoute()` i `AgentRegistry` |
| Arbetsflöden | Multi-agent-pipelines via `WorkflowEngine` |
| Autonoma agenter | Filhantering och terminalkörning via `AutonomousExecutor` |
| GuardRails | Checkpoint-snapshots och rollback för säkra ändringar |
```

### Command table (from package.json)

```markdown
## 📋 Kommandon

| Kommando | Beskrivning |
|----------|-------------|
| `/code` | Analysera och generera kod |
| `/docs` | Dokumentationshjälp |
| `/test` | Generera tester |
| `/review` | Kodgranskning |
| `/refactor` | Refaktorera kod |
```

### Development section

```markdown
## 🛠️ Utveckling

| Kommando | Beskrivning |
|----------|-------------|
| `npm run compile` | Kompilera TypeScript (`tsc -p ./`) |
| `npm run watch` | Kompilera i watch-läge |
| `npm run lint` | Kör ESLint (`eslint src --ext ts`) |
| `npm test` | Kör enhetstester (Vitest) |
| `npm run test:coverage` | Tester med kodtäckning (v8) |
| `npm run test:e2e` | E2E-tester (`@vscode/test-electron`) |
| `npm run package` | Paketera VSIX (`vsce package --no-dependencies`) |
```

## Rules

- **Swedish** for all user-facing text (descriptions, section headers content, table entries).
- **English** for code identifiers, file paths, and command names.
- Emoji section headers are mandatory: 🚀, 📋, ⚙️, 🏗️, 🛠️, 📦, 📄.
- Command tables must stay in sync with `package.json` `contributes.chatParticipants[0].commands`.
- The README is included in the VSIX — keep it concise and accurate.
- Architecture descriptions must reference real module paths (e.g., `src/agents/index.ts`).
- VS Code engine requirement is `^1.93.0` — always mention this.
- Zero runtime dependencies — state this clearly in the README.

## Checklist

- [ ] All sections follow the prescribed order
- [ ] Swedish used for user-facing text, English for code
- [ ] Emoji headers present on all major sections
- [ ] Command table matches `package.json` slash commands
- [ ] Settings table reflects current `contributes.configuration`
- [ ] Architecture section references real source paths
- [ ] Development commands are accurate and runnable
- [ ] `vsce package --no-dependencies` includes the README without errors
- [ ] No broken Markdown links or malformed tables
