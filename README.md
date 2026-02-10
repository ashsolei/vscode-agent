# 🤖 VS Code Agent

En modulär, utbyggbar agent-struktur för VS Code Chat med **30+ specialiserade AI-agenter**, autonoma filändringar, cross-window-synkronisering, marketplace, telemetri och en komplett utvecklingsplattform.

**80+ filer · 10 000+ rader TypeScript · 30+ agenter · 22 moduler · 37 slash-commands · 30 kommandon**

---

## ✨ Features

| Feature | Beskrivning |
|---|---|
| **30+ agenter** | Allt från kodgenerering till fullstack-scaffolding |
| **Smart Auto-Router** | LLM väljer automatiskt rätt agent — ingen slash-command behövs |
| **Agentkedjor** | Agenter kan delegera till varandra och köra i sekvens |
| **Parallell exekvering** | Kör flera agenter samtidigt |
| **Workflow Engine** | Multi-agent-pipelines med villkor, retry och parallella grupper |
| **Autonoma agenter** | Skapar, redigerar och tar bort filer + kör terminalkommandon |
| **Guard Rails** | Checkpoints, rollback/undo, dry-run och bekräftelsedialoger |
| **Persistent minne** | Agenter minns fakta och beslut mellan sessioner |
| **Event-driven** | Trigga agenter automatiskt vid save, fel, nya filer, intervall |
| **Middleware** | Timing, usage-tracking, rate-limiting hooks |
| **Webview Dashboard** | Realtidsstatistik, aktivitetslogg, topplista |
| **Sidebar Tree View** | Alla agenter i sidopanelen med ikoner och användningsdata |
| **CodeLens** | Inline-knappar "Dokumentera", "Fixa TODO", "Refaktorera", "Testa" |
| **Projektconfig** | `.agentrc.json` per projekt — custom prompts, workflows, regler |
| **Cross-window sync** | Delat tillstånd mellan VS Code-fönster |
| **Plugin System** | Hot-reload JSON-plugins från `.agent-plugins/` |
| **Status Bar** | Realtidsstatus — aktiv agent, anropsräknare, minne, plugins |
| **Diff Preview** | Förhandsgranska ändringar innan de appliceras |
| **Multi-Model Support** | Välj LLM per agent eller kategori (GPT-4, Claude, etc.) |
| **Test Runner + Self-Correct** | Kör tester, analysera fel, auto-fixa i loop (max 3 iterationer) |
| **Agent Collaboration** | Röstning, debatt och konsensus mellan agenter |
| **Context Providers** | Automatisk kontext: git diff, diagnostik, beroenden, öppna filer |
| **Meta-agent** | `/create-agent` — skapa nya agenter med AI |
| **Snippet Library** | Spara, sök och infoga agentgenererade kodsnuttar |
| **Notification Center** | Toast-notifieringar, historik, progress-tracking |
| **Agent Profiles** | Förkonfigurerade profiler: Frontend, Backend, Review, DevOps, Learning |
| **Conversation Persistence** | Spara/återuppta chattar, sök, tagga, pin, exportera |
| **Telemetry & Analytics** | Webview dashboard med grafer, success rate, trender |
| **External Integrations** | Skapa GitHub Issues, Slack-meddelanden, Jira-tickets direkt |
| **Agent Marketplace** | Bläddra, installera, publicera och betygsätt community-agenter |

---

## 🚀 Kom igång

### Förutsättningar

- [VS Code](https://code.visualstudio.com/) ≥ 1.93.0
- [Node.js](https://nodejs.org/) ≥ 18
- GitHub Copilot Chat (eller annan Chat Participant-kompatibel extension)

### Installation

```bash
# Klona repot
git clone https://github.com/ashsolei/vscode-agent.git
cd vscode-agent

# Installera beroenden
npm install

# Kompilera
npm run compile
```

### Starta i debug-läge

1. Öppna projektet i VS Code:
   ```bash
   code .
   ```
2. Tryck **F5** (eller **Run → Start Debugging**)
3. Ett nytt VS Code-fönster öppnas — extensionen är aktiv där

### Använda agenterna

Öppna **Chat-panelen** (⌘⇧I / Ctrl+Shift+I) i debug-fönstret.

#### Med slash-kommando (direkt routing)

```
@agent /code skriv en sorteringsfunktion i TypeScript
@agent /test generera enhetstester för UserService
@agent /refactor bryt ut denna funktion
@agent /scaffold en Express REST-API med auth
@agent /autofix fixa alla TypeScript-fel
@agent /fullstack skapa en todo-app med React + Express + SQLite
@agent /testrunner kör alla tester och fixa fel automatiskt
@agent /create-agent skapa en agent som optimerar Docker-filer
```

#### Utan slash-kommando (smart auto-routing)

```
@agent hur refaktorerar jag den här filen?
@agent finns det säkerhetsproblem i min kod?
@agent skapa en React-komponent för en datatabell
```

Smart Auto-Router (LLM-baserad) analyserar meddelandet och väljer automatiskt rätt agent.

#### Collaboration (multi-agent-beslut)

```
@agent /collab-vote code,review,security  — agenter röstar på bästa lösningen
@agent /collab-debate code,architect       — agenter debatterar och förbättrar
@agent /collab-consensus code,review,perf  — syntetisera konsensus-svar
```

#### Workflows (multi-agent-pipelines)

```
@agent /workflow-quality          # review → test → security + perf
@agent /workflow-ship login-sida  # plan → scaffold → code → test → docs → review
@agent /workflow-fix              # autofix → test → security
```

### Profiler

Byt agentprofil via statusfältet eller `⌘⇧P → Agent: Byt profil`:

| Profil | Fokus | Agenter |
|---|---|---|
| 🎨 **Frontend** | UI, komponenter, styling | code, component, a11y, review, test |
| ⚙️ **Backend** | API, databas, säkerhet | code, api, db, security, perf, devops |
| 🔍 **Review** | Granskning, kvalitet | review, security, perf, a11y, metrics |
| 🚀 **Fullstack** | Allt tillgängligt | fullstack, scaffold, autofix, devops |
| 📚 **Learning** | Förklaringar, pedagogik | explain, docs, docgen, architect |
| 🐳 **DevOps** | CI/CD, infra | devops, cli, git, db, security |

Du kan också skapa egna profiler med `Agent: Skapa ny profil`.

### Konversationer

Agenten sparar automatiskt alla konversationer. Hantera via `⌘⇧P`:

- **Agent: Visa konversationer** — bläddra, sök, pinna
- **Agent: Spara konversation** — ge namn och taggar
- **Agent: Ny konversation** — börja om med rent blad

### Analytics

`⌘⇧P → Agent: Visa analytics dashboard` öppnar ett webview-dashboard med:
- Totala anrop, lyckandegrad, snitttid
- Daglig aktivitetsgraf (14 dagar)
- Top 10 agenter
- Detaljerad agent-rapport

### Marketplace

`⌘⇧P → Agent: Öppna Marketplace` — bläddra bland community-agenter:
- **Installera** med ett klick
- **Publicera** dina egna plugins
- **Betygsätt** med 1–5 stjärnor
- Inbyggda: Regex Helper, SQL Wizard, Color Palette, Commit Writer, Env Manager

### External Integrations

Rapportera direkt till externa tjänster via knappen **📤 Rapportera externt** eller `⌘⇧P → Agent: Skapa extern issue`:

- **GitHub Issues** — skapar issue med label `agent-generated`
- **Slack** — skickar rapport via webhook
- **Jira** — skapar ticket med ADF-format

### Sidopanelen

Klicka på **🤖-ikonen** i Activity Bar. Alla 26 agenter visas grupperade med ikoner och användningsstatistik. Klicka för att starta.

### CodeLens

Öppna valfri `.ts`/`.js`/`.py`-fil. Inline-knappar visas automatiskt:
- **📝 Dokumentera** — funktioner utan JSDoc
- **🤖 Fixa TODO** — TODO/FIXME/HACK-kommentarer
- **⚡ Refaktorera (X rader)** — funktioner > 50 rader
- **🧪 Generera tester** — exporterade klasser

### Kommandon (⌘⇧P)

| Kommando | Beskrivning |
|---|---|
| `Agent: Visa Dashboard` | Öppna webview med realtidsstatistik |
| `Agent: Visa analytics dashboard` | Telemetri: grafer, trender, agentrapport |
| `Agent: Ångra senaste agent-ändring` | Rollback till senaste checkpoint |
| `Agent: Skapa .agentrc.json` | Skapa projektconfig |
| `Agent: Visa minnesstatistik` | Se agenternas persistenta minne |
| `Agent: Rensa agentminne` | Radera alla minnen |
| `Agent: Slå av/på CodeLens` | Toggla inline-knappar |
| `Agent: Visa delat tillstånd` | Debug cross-window state |
| `Agent: Byt profil` | Växla agentprofil |
| `Agent: Skapa ny profil` | Wizard för ny profil |
| `Agent: Exportera profil` | Exportera aktiv profil som JSON |
| `Agent: Importera profil` | Importera profil från fil |
| `Agent: Visa konversationer` | Bläddra sparade konversationer |
| `Agent: Spara konversation` | Spara aktuell chatt |
| `Agent: Ny konversation` | Starta ny chatt |
| `Agent: Öppna Marketplace` | Bläddra community-agenter |
| `Agent: Skapa ny plugin-agent` | Skapa plugin interaktivt |
| `Agent: Visa modell-konfiguration` | Se tillgängliga LLM-modeller |
| `Agent: Förhandsgranska ändringar` | Diff-preview av väntande ändringar |
| `Agent: Spara som snippet` | Spara kodsnutt från agent |
| `Agent: Visa snippet-bibliotek` | Bläddra sparade snippets |
| `Agent: Infoga snippet` | Klistra in snippet i editor |
| `Agent: Exportera snippets` | Exportera snippets som JSON |
| `Agent: Visa notifieringar` | Notifikationshistorik |
| `Agent: Rensa notifieringar` | Rensa historik |
| `Agent: Skapa extern issue` | Rapportera till GitHub/Slack/Jira |
| `Agent: Rensa telemetri` | Radera all telemetridata |

---

## 🏗️ Arkitektur

```
src/
├── extension.ts              # Entry point — kopplar ihop allt (~780 rader)
├── agents/                   # 30+ agenter + registry + basklass
│   ├── base-agent.ts         # Abstrakt basklass (handle, chat, delegateTo)
│   ├── index.ts              # AgentRegistry (routing, chaining, parallel, smart-router)
│   ├── code-agent.ts         # 💻 Kodgenerering
│   ├── docs-agent.ts         # 📚 Dokumentation
│   ├── task-agent.ts         # 📋 Uppgiftshantering
│   ├── status-agent.ts       # 📊 Systeminformation
│   ├── refactor-agent.ts     # 🔄 Refaktorering
│   ├── review-agent.ts       # 👁️ Kodgranskning
│   ├── test-agent.ts         # 🧪 Testgenerering
│   ├── debug-agent.ts        # 🐛 Debugging
│   ├── security-agent.ts     # 🔒 Säkerhetsanalys
│   ├── perf-agent.ts         # ⚡ Prestandaanalys
│   ├── architect-agent.ts    # 🏗️ Arkitekturdesign
│   ├── api-agent.ts          # 🌐 API-design
│   ├── translate-agent.ts    # 🌍 Kodöversättning
│   ├── dependency-agent.ts   # 📦 Beroendehantering
│   ├── explain-agent.ts      # 🎓 Kodförklaring
│   ├── git-agent.ts          # 🔀 Git-operationer
│   ├── scaffold-agent.ts     # 🤖 Projektscaffolding
│   ├── autofix-agent.ts      # 🤖 Automatisk felfix
│   ├── devops-agent.ts       # 🤖 CI/CD & DevOps
│   ├── database-agent.ts     # 🤖 Databasdesign
│   ├── migrate-agent.ts      # 🤖 Ramverksmigrering
│   ├── component-agent.ts    # 🤖 UI-komponentgenerering
│   ├── i18n-agent.ts         # 🤖 Internationalisering
│   ├── planner-agent.ts      # 🤖 Uppgiftsplanering
│   ├── a11y-agent.ts         # 🤖 Tillgänglighet
│   ├── docgen-agent.ts       # 🤖 Dokumentationsgenerering
│   ├── metrics-agent.ts      # 🤖 Kodmetriker
│   ├── cli-agent.ts          # 🤖 CLI-generering
│   ├── fullstack-agent.ts    # 🤖 Fullstack-appgenerering
│   ├── testrunner-agent.ts   # 🧪 Tester + self-correct
│   └── create-agent-agent.ts # 🧬 Meta-agent — skapar nya agenter
├── autonomous/               # AutonomousExecutor (filer, terminal, diagnostik)
├── collaboration/            # AgentCollaboration (vote, debate, consensus)
├── config/                   # ConfigManager (.agentrc.json)
├── context/                  # ContextProviderRegistry (git-diff, diagnostik, etc.)
├── conversations/            # ConversationPersistence (spara/återuppta chattar)
├── dashboard/                # Webview Dashboard (realtidsstatistik)
├── diff/                     # DiffPreview (förhandsgranska ändringar)
├── events/                   # EventDrivenEngine (onSave, onDiagnostics, etc.)
├── guardrails/               # GuardRails (checkpoints, rollback, dry-run)
├── integrations/             # ExternalIntegrations (GitHub, Slack, Jira)
├── marketplace/              # AgentMarketplace (browse, install, publish, rate)
├── memory/                   # AgentMemory (persistent minne mellan sessioner)
├── middleware/                # MiddlewarePipeline (timing, usage, rate-limit)
├── models/                   # ModelSelector (per-agent LLM-val)
├── notifications/            # NotificationCenter (toast, historik, progress)
├── plugins/                  # PluginLoader (hot-reload .agent-plugins/*.json)
├── profiles/                 # AgentProfileManager (frontend/backend/review/etc.)
├── prompts/                  # Systemprompter
├── snippets/                 # SnippetLibrary (spara, sök, infoga kodsnuttar)
├── state/                    # SharedState (cross-window sync)
├── statusbar/                # AgentStatusBar (aktiv agent, räknare, minne)
├── telemetry/                # TelemetryEngine (analytics, grafer, trender)
├── tools/                    # ToolRegistry (FileTool, SearchTool)
├── views/                    # TreeView + CodeLens
│   ├── agent-tree.ts         # Sidebar Tree View
│   └── agent-codelens.ts     # CodeLens-integration
└── workflow/                 # WorkflowEngine (JSON-pipelines)
```

### Arkitekturdiagram

```mermaid
graph TB
    subgraph "Ingång"
        USER["👤 Användare"] -->|meddelande| HANDLER["ChatRequestHandler"]
    end

    HANDLER -->|"/slash-kommando"| REGISTRY["AgentRegistry"]
    HANDLER -->|"utan kommando"| SMART["🧠 Smart Auto-Router"]
    HANDLER -->|"/workflow-*"| WORKFLOW["🔄 WorkflowEngine"]
    HANDLER -->|"/collab-*"| COLLAB["🤝 AgentCollaboration"]
    SMART --> REGISTRY
    COLLAB -->|"vote / debate / consensus"| REGISTRY

    REGISTRY -->|"resolve()"| MW["Middleware Pipeline"]
    MW -->|"before → execute → after"| AGENTS["BaseAgent"]

    subgraph "Infrastruktur"
        STATE["SharedState\n🔄 Cross-window"]
        TOOLS["ToolRegistry\n🔧 Fil & Sök"]
        EXECUTOR["AutonomousExecutor\n📁 Filer · 🖥️ Terminal"]
        MEMORY["AgentMemory\n🧠 Persistent minne"]
        GUARDS["GuardRails\n🛡️ Rollback · Dry-run"]
        CONFIG["ConfigManager\n⚙️ .agentrc.json"]
        EVENTS["EventDrivenEngine\n🔔 onSave · onError"]
        CTX["ContextProviders\n📋 Git · Diagnostik"]
        MODELS["ModelSelector\n🤖 Per-agent LLM"]
    end

    subgraph "Plattform"
        DASH["📊 Analytics Dashboard"]
        PROFILES["🎭 Profiler"]
        CONVOS["💬 Konversationer"]
        SNIPPETS["📋 Snippets"]
        NOTIFS["🔔 Notifieringar"]
        MARKETPLACE["🏪 Marketplace"]
        PLUGINS["🔌 Plugin System"]
        INTEGRATIONS["📤 GitHub · Slack · Jira"]
        DIFFPREV["📝 Diff Preview"]
        STATUSBAR["📊 Status Bar"]
        TELEMETRY["📈 Telemetri"]
    end

    subgraph "30+ Agenter"
        A1["💻 code · 📚 docs · 📋 task · 📊 status"]
        A2["🔄 refactor · 👁️ review · 🧪 test · 🐛 debug"]
        A3["🔒 security · ⚡ perf · 🏗️ architect · 🌐 api"]
        A4["🌍 translate · 📦 deps · 🎓 explain · 🔀 git"]
        A5["🤖 scaffold · autofix · devops · db · migrate"]
        A6["🤖 component · i18n · plan · a11y · docgen"]
        A7["🤖 metrics · cli · fullstack · testrunner"]
        A8["🧬 create-agent"]
    end

    AGENTS --> A1 & A2 & A3 & A4 & A5 & A6 & A7 & A8

    A1 & A2 & A3 & A4 -.-> TOOLS
    A5 & A6 & A7 -.-> EXECUTOR
    EXECUTOR -.-> GUARDS

    REGISTRY -->|"delegate() / chain()"| AGENTS
    REGISTRY -->|"parallel()"| AGENTS
    WORKFLOW -->|"sekvens + parallell"| REGISTRY

    MW -.-> TELEMETRY
    TELEMETRY -.-> DASH
    HANDLER -.-> CONVOS
    HANDLER -.-> NOTIFS
    A8 -.-> PLUGINS

    subgraph "VS Code UI"
        TREE["🌳 Sidebar Tree View"]
        LENS["🔍 CodeLens"]
        BAR["📊 Status Bar"]
        PROFILE_BAR["🎭 Profil i statusfält"]
    end
```

### Dataflöde

```mermaid
sequenceDiagram
    participant U as Användare
    participant P as Profiles
    participant H as ChatHandler
    participant C as Conversations
    participant R as Router/Registry
    participant MW as Middleware
    participant A as Agent
    participant T as Telemetry
    participant E as Executor
    participant G as GuardRails
    participant N as Notifications

    U->>P: Aktiv profil: Backend Mode
    U->>H: @agent /scaffold REST API
    H->>C: spara meddelande
    H->>R: resolve("scaffold")
    R->>MW: execute(agent, ctx)
    MW->>MW: before (rate-limit, timing)
    MW->>A: handle(ctx)
    A->>G: createCheckpoint()
    G-->>A: checkpoint-id
    A->>E: createFiles([...])
    E-->>A: ActionResult[]
    A->>E: runCommand("npm install")
    E-->>A: exit code 0
    A-->>MW: AgentResult
    MW->>MW: after (usage-stats, timing)
    MW->>T: log(agentId, duration, success)
    MW-->>H: result
    H->>C: spara agent-svar
    H->>N: notifyAgentDone()
    H-->>U: Kod + snippet-knapp + integrations-knapp
```

---

## ⚙️ Projektconfig (.agentrc.json)

Skapa en `.agentrc.json` i ditt projekt (eller kör `Agent: Skapa .agentrc.json`):

```json
{
  "defaultAgent": "code",
  "language": "sv",
  "autoRouter": true,
  "disabledAgents": [],
  "memory": {
    "enabled": true,
    "maxAge": 2592000000
  },
  "guardrails": {
    "confirmDestructive": true,
    "dryRunDefault": false
  },
  "prompts": {
    "code": "Du är en senior TypeScript-utvecklare. Använd strikta typer.",
    "test": "Generera tester med Vitest. Använd describe/it-mönster."
  }
}
```

---

## 🔧 Alla agenter

### Grundläggande
| Agent | Kommando | Beskrivning |
|---|---|---|
| Code | `/code` | Kodgenerering och analys |
| Docs | `/docs` | Dokumentationssökning och generering |
| Task | `/task` | Uppgiftshantering (persistent) |
| Status | `/status` | Systemstatus och konfiguration |

### Kodkvalitet
| Agent | Kommando | Beskrivning |
|---|---|---|
| Refactor | `/refactor` | Refaktorering och kodförbättring |
| Review | `/review` | Kodgranskning |
| Test | `/test` | Testgenerering |
| Debug | `/debug` | Debugging-hjälp |

### Prestanda & Säkerhet
| Agent | Kommando | Beskrivning |
|---|---|---|
| Security | `/security` | Säkerhetsanalys |
| Perf | `/perf` | Prestandaoptimering |

### Arkitektur
| Agent | Kommando | Beskrivning |
|---|---|---|
| Architect | `/architect` | Systemarkitektur |
| API | `/api` | API-design |

### Verktyg
| Agent | Kommando | Beskrivning |
|---|---|---|
| Translate | `/translate` | Kodöversättning mellan språk |
| Deps | `/deps` | Beroendehantering |
| Explain | `/explain` | Pedagogisk kodförklaring |
| Git | `/git` | Git-operationer |

### 🤖 Autonoma (gör faktiska filändringar)
| Agent | Kommando | Beskrivning |
|---|---|---|
| Scaffold | `/scaffold` | Projektscaffolding |
| AutoFix | `/autofix` | Automatisk felfix |
| DevOps | `/devops` | CI/CD-konfiguration |
| Database | `/db` | Databasschema och ORM |
| Migrate | `/migrate` | Ramverksmigrering |
| Component | `/component` | UI-komponentgenerering |
| I18n | `/i18n` | Internationalisering |
| Planner | `/plan` | Uppgiftsplanering |
| A11y | `/a11y` | Tillgänglighetsfix |
| DocGen | `/docgen` | Komplett dokumentation |
| Metrics | `/metrics` | Kodkvalitetsmetriker |
| CLI | `/cli` | CLI-verktygskapande |
| Fullstack | `/fullstack` | Komplett webapp |

### 🧪 Testning & Meta
| Agent | Kommando | Beskrivning |
|---|---|---|
| TestRunner | `/testrunner` | Kör tester, self-correct i loop |
| CreateAgent | `/create-agent` | Skapa nya agenter med AI |

### 🤝 Collaboration
| Kommando | Beskrivning |
|---|---|
| `/collab-vote` | Agenter röstar — bästa svaret vinner |
| `/collab-debate` | Agenter debatterar och förbättrar |
| `/collab-consensus` | AI syntetiserar konsensus-svar |

---

## 📦 Publicera som VSIX

```bash
npm install -g @vscode/vsce
vsce package
# → vscode-agent-0.1.0.vsix

# Installera lokalt:
code --install-extension vscode-agent-0.1.0.vsix
```

---

## 📄 Licens

MIT
