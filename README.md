# 🤖 VS Code Agent

En modulär, utbyggbar agent-struktur för VS Code Chat med **30+ specialiserade AI-agenter**, autonoma filändringar, cross-window-synkronisering, marketplace, telemetri och en komplett utvecklingsplattform.

**85+ filer · 12 000+ rader TypeScript · 30+ agenter · 25 moduler · 37 slash-commands · 30 kommandon · 680 enhetstester · CI/CD · Docker · i18n (EN/SV)**

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
| **Response Cache** | LRU-cache för LLM-svar med TTL, eviction och agent-invalidering |
| **i18n (EN/SV)** | Fullständigt tvåspråkigt stöd med `t()` translate-funktion |
| **680 enhetstester** | Vitest med VS Code API-mock, 32 testfiler, v8 coverage |
| **CI/CD** | GitHub Actions: build → lint → test → VSIX → Docker |
| **Docker** | Multi-stage Dockerfile för reproducerbar VSIX-paketning |
| **Health Check** | Inbyggt diagnostikkommando för att verifiera systemstatus |
| **E2E-tester** | `@vscode/test-electron` med integrationstester i riktig VS Code |
| **16 inställningar** | Alla settings exponerade i VS Code Settings UI |
| **8 tangentbordsgenvägar** | Cmd+Shift+A/D/S/H/N/U/T/M |
| **Walkthrough** | 6-stegs interaktiv onboarding-guide |
| **Welcome View** | Välkomstvy med knappar i tom sidebar |

---

## 🚀 Kom igång

### Förutsättningar

- [VS Code](https://code.visualstudio.com/) ≥ 1.93.0
- [Node.js](https://nodejs.org/) ≥ 18
- GitHub Copilot Chat (eller annan Chat Participant-kompatibel extension)

### Installation

```bash
# 1. Klona repot
git clone https://github.com/ashsolei/vscode-agent.git
cd vscode-agent

# 2. Installera beroenden
npm install

# 3. Kompilera
npm run compile

# 4. Kör tester (valfritt men rekommenderas)
npm test
```

### Starta extensionen (debug-läge)

```bash
code .    # Öppna projektet i VS Code
```

1. Tryck **F5** (eller **Run → Start Debugging**)
2. Ett nytt VS Code-fönster ("Extension Development Host") öppnas
3. Extensionen är aktiv — du ser 🤖-ikonen i sidopanelen

> **Tips:** Alternativt, öppna **Run and Debug** (⌘⇧D) och välj **"Run Extension"** från dropdown-menyn.

### Walkthrough (interaktiv guide)

Första gången extensionen startar kan du köra walkthrough:

1. `⌘⇧P` → sök **"Getting Started with VS Code Agent"**
2. Följ de 6 stegen: öppna chat → prova kommandon → aktivera profil → utforska sidebar → autonoma agenter → analytics

### Installera som VSIX (utan debug)

```bash
# Paketera
npm run package
# → vscode-agent-0.1.0.vsix

# Installera lokalt
code --install-extension vscode-agent-0.1.0.vsix
```

---

## 💬 Använda agenterna

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
├── __mocks__/
│   └── vscode.ts             # Komplett VS Code API-mock (Vitest)
├── agents/                   # 30+ agenter + registry + basklass
│   ├── base-agent.ts         # Abstrakt basklass (handle, chat, delegateTo)
│   ├── index.ts              # AgentRegistry (routing, chaining, parallel, smart-router)
│   ├── registry.test.ts      # ✅ 8 tester
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
├── cache/                    # Response Cache (LRU med TTL)
│   ├── response-cache.ts     # 💾 LRU-cache, eviction, invalidering
│   ├── index.ts
│   └── cache.test.ts         # ✅ 12 tester
├── collaboration/            # AgentCollaboration (vote, debate, consensus)
├── config/                   # ConfigManager (.agentrc.json)
├── context/                  # ContextProviderRegistry (git-diff, diagnostik, etc.)
├── conversations/            # ConversationPersistence (spara/återuppta chattar)
│   ├── conversation-persistence.ts
│   └── conversations.test.ts # ✅ 11 tester
├── dashboard/                # Webview Dashboard (realtidsstatistik)
├── diff/                     # DiffPreview (förhandsgranska ändringar)
├── events/                   # EventDrivenEngine (onSave, onDiagnostics, etc.)
├── guardrails/               # GuardRails (checkpoints, rollback, dry-run)
├── i18n/                     # Internationalisering (EN + SV)
│   ├── index.ts              # 🌍 t(), setLocale(), detectLocale(), 60+ nycklar
│   └── i18n.test.ts          # ✅ 13 tester
├── integrations/             # ExternalIntegrations (GitHub, Slack, Jira)
├── marketplace/              # AgentMarketplace (browse, install, publish, rate)
├── memory/                   # AgentMemory (persistent minne mellan sessioner)
│   ├── agent-memory.ts
│   └── memory.test.ts        # ✅ 13 tester
├── middleware/                # MiddlewarePipeline (timing, usage, rate-limit)
├── models/                   # ModelSelector (per-agent LLM-val)
├── notifications/            # NotificationCenter (toast, historik, progress)
├── plugins/                  # PluginLoader (hot-reload .agent-plugins/*.json)
├── profiles/                 # AgentProfileManager (frontend/backend/review/etc.)
│   ├── agent-profiles.ts
│   └── profiles.test.ts      # ✅ 13 tester
├── prompts/                  # Systemprompter
├── snippets/                 # SnippetLibrary (spara, sök, infoga kodsnuttar)
│   ├── snippet-library.ts
│   └── snippets.test.ts      # ✅ 6 tester
├── state/                    # SharedState (cross-window sync)
├── statusbar/                # AgentStatusBar (aktiv agent, räknare, minne)
├── telemetry/                # TelemetryEngine (analytics, grafer, trender)
│   ├── telemetry-engine.ts
│   └── telemetry.test.ts     # ✅ 9 tester
├── test/                     # E2E-tester
│   └── e2e/
│       ├── runTest.ts         # Test launcher
│       └── suite/
│           ├── index.ts       # Mocha test runner
│           └── extension.test.ts # ✅ 6 integrationstester
├── tools/                    # ToolRegistry (FileTool, SearchTool)
├── views/                    # TreeView + CodeLens
│   ├── agent-tree.ts         # Sidebar Tree View
│   └── agent-codelens.ts     # CodeLens-integration
└── workflow/                 # WorkflowEngine (JSON-pipelines)

media/
└── walkthrough/              # 6-stegs onboarding-guide
    ├── step1.md … step6.md
.github/
└── workflows/
    └── ci.yml                # GitHub Actions: build → lint → test → VSIX
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
    MW -->|"before → execute → after"| CACHE["💾 Response Cache"]
    CACHE -->|"miss"| AGENTS["BaseAgent"]
    CACHE -->|"hit"| HANDLER

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
        I18N["i18n\n🌍 EN · SV"]
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

    subgraph "Kvalitet & CI/CD"
        TESTS["✅ 85 Enhetstester\nVitest + v8 coverage"]
        E2E["🧪 E2E-tester\n@vscode/test-electron"]
        CI["🔄 GitHub Actions\nbuild → lint → test → VSIX"]
        SETTINGS["⚙️ 16 Settings\nVS Code UI"]
        KEYS["⌨️ 8 Genvägar\nCmd+Shift+*"]
        WALK["📖 Walkthrough\n6-stegs onboarding"]
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
    AGENTS -.-> I18N

    subgraph "VS Code UI"
        TREE["🌳 Sidebar + Welcome View"]
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
    participant $$ as Response Cache
    participant A as Agent
    participant I as i18n
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
    MW->>$$: lookup(prompt, command)
    alt Cache HIT
        $$-->>H: cachat svar
    else Cache MISS
        $$->>A: handle(ctx)
        A->>I: t('agent.processing')
        A->>G: createCheckpoint()
        G-->>A: checkpoint-id
        A->>E: createFiles([...])
        E-->>A: ActionResult[]
        A->>E: runCommand("npm install")
        E-->>A: exit code 0
        A-->>$$: cache response
        A-->>MW: AgentResult
    end
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
vsce package --no-dependencies
# → vscode-agent-0.1.0.vsix

# Installera lokalt:
code --install-extension vscode-agent-0.1.0.vsix

# Publicera till Marketplace:
vsce publish --no-dependencies
```

---

## ⌨️ Tangentbordsgenvägar

| Genväg (Mac) | Genväg (Win/Linux) | Kommando |
|---|---|---|
| `⌘⇧A` | `Ctrl+Shift+A` | Byt profil |
| `⌘⇧D` | `Ctrl+Shift+D` | Visa Dashboard |
| `⌘⇧S` | `Ctrl+Shift+S` | Visa Snippets |
| `⌘⇧H` | `Ctrl+Shift+H` | Visa Konversationer |
| `⌘⇧N` | `Ctrl+Shift+N` | Visa Notifieringar |
| `⌘⇧U` | `Ctrl+Shift+U` | Ångra senaste ändring |
| `⌘⇧T` | `Ctrl+Shift+T` | Visa Analytics |
| `⌘⇧M` | `Ctrl+Shift+M` | Öppna Marketplace |

---

## ⚙️ Inställningar (Settings)

Alla inställningar finns under **Settings → Extensions → VS Code Agent** (eller `vscodeAgent.*` i JSON):

| Inställning | Typ | Standard | Beskrivning |
|---|---|---|---|
| `vscodeAgent.defaultProfile` | string | `""` | Standardprofil vid start (frontend, backend, etc.) |
| `vscodeAgent.locale` | enum | `auto` | Språk: `auto`, `en`, `sv` |
| `vscodeAgent.cache.enabled` | bool | `true` | Response-cache för upprepade prompts |
| `vscodeAgent.cache.ttlMinutes` | number | `10` | Cache TTL i minuter |
| `vscodeAgent.cache.maxEntries` | number | `200` | Max cachade svar |
| `vscodeAgent.telemetry.enabled` | bool | `true` | Lokal telemetri (skickas aldrig externt) |
| `vscodeAgent.guardrails.enabled` | bool | `true` | Guardrails med rollback |
| `vscodeAgent.guardrails.dryRun` | bool | `false` | Dry-run mode (preview only) |
| `vscodeAgent.memory.maxEntries` | number | `500` | Max antal agentminnen |
| `vscodeAgent.memory.pruneAfterDays` | number | `30` | Auto-rensa minnen äldre än X dagar |
| `vscodeAgent.codeLens.enabled` | bool | `true` | Visa CodeLens i källfiler |
| `vscodeAgent.notifications.enabled` | bool | `true` | Notifieringar vid agenthändelser |
| `vscodeAgent.models.default` | string | `auto` | Standard-LLM (gpt-4o, claude-3.5-sonnet, etc.) |
| `vscodeAgent.autonomous.maxSteps` | number | `10` | Max steg för autonoma agenter |
| `vscodeAgent.autonomous.confirmBeforeApply` | bool | `true` | Bekräfta innan autonoma ändringar |
| `vscodeAgent.sidebar.showOnStartup` | bool | `false` | Visa sidebar automatiskt |

---

## 🧪 Testning

```bash
# Kör alla enhetstester
npm test

# Kör med watch mode
npm run test:watch

# Kör med coverage-rapport
npm run test:coverage

# Kör E2E-tester (kräver VS Code)
npm run test:e2e
```

**Teststruktur:**
- `src/**/*.test.ts` — Enhetstester (Vitest)
- `src/__mocks__/vscode.ts` — Komplett VS Code API-mock
- `src/test/e2e/` — E2E-tester med `@vscode/test-electron`

**Testade moduler:**
| Modul | Tester | Testar |
|---|---|---|
| AgentRegistry | 8 | register, resolve, delegate, chain |
| AgentRegistry (ext.) | 12 | unregister, parallel, chain, duplicate, isAutonomous |
| AgentMemory | 13 | remember, forget, recall, search, findByTags, prune, stats |
| ResponseCache | 12 | set, get, TTL, eviction, invalidate, prune, stats |
| MiddlewarePipeline | 7 | exec, skip, priority, error isolation, meta |
| Built-in Middlewares | 7 | timing, usage tracking, rate limiting |
| ToolRegistry | 6 | register, get, list, execute, createDefault |
| FileTool | 5 | read, search, list, errors |
| SearchTool | 3 | text search, empty results, missing query |
| ConversationPersistence | 11 | add, list, search, tag, pin, startNew, load |
| AgentProfileManager | 13 | activate, deactivate, create, duplicate, onDidChange |
| SnippetLibrary | 6 | save, delete, search, toggleFavorite |
| TelemetryEngine | 9 | log, overview, agentStats, dailySummary, clear |
| i18n | 13 | translate, locale switch, fallback, format args |

---

## 🔄 CI/CD

GitHub Actions körs automatiskt vid push/PR till `main`:

```
Build (Node 18 + 20)  →  Lint  →  Test (coverage)  →  Package VSIX  →  Docker Build
```

VSIX-artefakten laddas upp och kan hämtas från Actions-fliken.
Concurrency groups förhindrar onödiga parallella körningar.

---

## 🐳 Docker

Bygg extensionen som en Docker-image (multi-stage, reproducerbar):

```bash
# Bygg image
docker build -t vscode-agent:latest .

# Extrahera VSIX
docker create --name vscode-tmp vscode-agent:latest
docker cp vscode-tmp:/output/vscode-agent.vsix .
docker rm vscode-tmp

# Installera
code --install-extension vscode-agent.vsix
```

Dockerfile använder 3 steg:
1. **Builder** — installerar deps, kompilerar TypeScript
2. **Packager** — bygger VSIX med `vsce`
3. **Output** — minimal Alpine-image med VSIX-artefakt

---

## ⚙️ Environment Variables & Settings

| Setting | Default | Beskrivning |
|---|---|---|
| `vscodeAgent.locale` | `auto` | Språk: `auto`, `en` eller `sv` |
| `vscodeAgent.rateLimitPerMinute` | `30` | Max agentanrop per minut |
| `vscodeAgent.defaultProfile` | `""` | Standard agentprofil |
| `vscodeAgent.cache.enabled` | `true` | Aktivera LLM-cache |
| `vscodeAgent.cache.maxEntries` | `200` | Max cacheade svar |
| `vscodeAgent.cache.ttlMinutes` | `10` | Cache TTL i minuter |
| `vscodeAgent.memory.pruneAfterDays` | `30` | Rensa minnen äldre än X dagar |
| `vscodeAgent.memory.maxEntries` | `500` | Max antal minnen |
| `vscodeAgent.guardrails.enabled` | `true` | Aktivera säkerhetsspärrar |
| `vscodeAgent.guardrails.dryRun` | `false` | Visa ändringar utan att utföra |
| `vscodeAgent.codeLens.enabled` | `true` | Visa inline-knappar |
| `vscodeAgent.models.default` | `auto` | Standard LLM-modell |
| `vscodeAgent.telemetry.enabled` | `true` | Aktivera lokal telemetri |
| `vscodeAgent.notifications.enabled` | `true` | Aktivera notifieringar |
| `vscodeAgent.sidebar.showOnStartup` | `false` | Visa sidopanel vid start |

Projektspecifik konfiguration kan ställas in i `.agentrc.json` (se `Agent: Skapa .agentrc.json`).

---

## 🩺 Troubleshooting

### Extensionen startar inte
1. Kontrollera VS Code-versionen: ≥ 1.93.0 krävs
2. Säkerställ att Copilot Chat är installerat
3. Kör `⌘⇧P → Agent: Health Check` för systemdiagnostik
4. Kontrollera Output-panelen ("VS Code Agent")

### Agenten svarar inte
1. Kolla att du inte nått rate limit (default: 30/min)
2. Testa med `/status` för att verifiera att agenten är aktiv
3. Rensa cache: `⌘⇧P → Agent: Rensa telemetri`

### Tester misslyckas lokalt
```bash
# Rensa och bygg om
rm -rf out/ node_modules/
npm install
npm run compile
npm test
```

### Plugin laddas inte
1. Verifiera att `.agent-plugins/` finns i workspace-roten
2. JSON-filer måste ha korrekt format (se plugindokumentation)
3. Plugins hot-reloadas — spara filen så laddas den om automatiskt

---

## 📄 Licens

MIT
