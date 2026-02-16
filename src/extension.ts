import * as vscode from 'vscode';
import { AgentRegistry, AgentContext } from './agents';
import { CodeAgent } from './agents/code-agent';
import { DocsAgent } from './agents/docs-agent';
import { TaskAgent } from './agents/task-agent';
import { StatusAgent } from './agents/status-agent';
import { RefactorAgent } from './agents/refactor-agent';
import { TestAgent } from './agents/test-agent';
import { GitAgent } from './agents/git-agent';
import { SecurityAgent } from './agents/security-agent';
import { PerfAgent } from './agents/perf-agent';
import { DebugAgent } from './agents/debug-agent';
import { ReviewAgent } from './agents/review-agent';
import { ArchitectAgent } from './agents/architect-agent';
import { TranslateAgent } from './agents/translate-agent';
import { DependencyAgent } from './agents/dependency-agent';
import { ExplainAgent } from './agents/explain-agent';
import { ApiAgent } from './agents/api-agent';
import { ScaffoldAgent } from './agents/scaffold-agent';
import { AutoFixAgent } from './agents/autofix-agent';
import { DevOpsAgent } from './agents/devops-agent';
import { DatabaseAgent } from './agents/database-agent';
import { MigrateAgent } from './agents/migrate-agent';
import { ComponentAgent } from './agents/component-agent';
import { I18nAgent } from './agents/i18n-agent';
import { PlannerAgent } from './agents/planner-agent';
import { A11yAgent } from './agents/a11y-agent';
import { DocGenAgent } from './agents/docgen-agent';
import { MetricsAgent } from './agents/metrics-agent';
import { CliAgent } from './agents/cli-agent';
import { FullstackAgent } from './agents/fullstack-agent';
import { TestRunnerAgent } from './agents/testrunner-agent';
import { ToolRegistry } from './tools';
import { SharedState } from './state';
import {
  MiddlewarePipeline,
  createTimingMiddleware,
  createUsageMiddleware,
  createRateLimitMiddleware,
} from './middleware';
import { AgentMemory } from './memory';
import { WorkflowEngine } from './workflow';
import { AgentDashboard } from './dashboard';
import { GuardRails } from './guardrails';
import { EventDrivenEngine } from './events';
import { ConfigManager } from './config';
import { AgentTreeProvider } from './views';
import { AgentCodeLensProvider } from './views/agent-codelens';
import { PluginLoader } from './plugins';
import { AgentStatusBar } from './statusbar';
import { DiffPreview } from './diff';
import { ModelSelector } from './models';
import { AgentCollaboration } from './collaboration';
import { ContextProviderRegistry } from './context';
import { CreateAgentAgent } from './agents/create-agent-agent';
import { SnippetLibrary } from './snippets';
import { NotificationCenter } from './notifications';
import { AgentProfileManager } from './profiles';
import { ConversationPersistence } from './conversations';
import { TelemetryEngine } from './telemetry';
import { ExternalIntegrations } from './integrations';
import { AgentMarketplace } from './marketplace';
import { ResponseCache } from './cache';
import { initI18n, setLocale, Locale } from './i18n';
import { createCaptureStream } from './utils';

/**
 * Extension entry point.
 * Sätter upp agentregistret, verktyg, delat tillstånd och VS Code Chat Participant.
 */
export function activate(context: vscode.ExtensionContext) {
  // --- 0. Initiera i18n ---
  const localeSetting = vscode.workspace.getConfiguration('vscodeAgent').get<string>('locale', 'auto');
  if (localeSetting === 'auto') {
    initI18n();
  } else {
    setLocale(localeSetting as Locale);
  }

  // --- 1. Initiera delat tillstånd (synkroniseras mellan fönster) ---
  const sharedState = new SharedState(
    context.globalState,
    context.globalStorageUri
  );

  // --- 2. Skapa verktygsregistret ---
  const tools = ToolRegistry.createDefault();

  // --- 2a2. Skapa response cache ---
  const cacheConfig = vscode.workspace.getConfiguration('vscodeAgent.cache');
  const responseCache = new ResponseCache(context.globalState, {
    maxEntries: cacheConfig.get<number>('maxEntries', 200),
    defaultTtl: (cacheConfig.get<number>('ttlMinutes', 10)) * 60 * 1000,
  });
  let cacheEnabled = cacheConfig.get<boolean>('enabled', true);

  // --- 2b. Skapa persistent minne ---
  const memoryConfig = vscode.workspace.getConfiguration('vscodeAgent.memory');
  const memory = new AgentMemory(context.globalState);
  // Automatisk rensning av gamla minnen (respektera settings)
  memory.prune({
    maxAge: (memoryConfig.get<number>('pruneAfterDays', 30)) * 24 * 60 * 60 * 1000,
    maxCount: memoryConfig.get<number>('maxEntries', 500),
  });

  // --- 2c. Skapa middleware-pipeline ---
  const outputChannel = vscode.window.createOutputChannel('VS Code Agent');
  context.subscriptions.push(outputChannel);

  const middleware = new MiddlewarePipeline();
  let rateLimitPerMin = vscode.workspace.getConfiguration('vscodeAgent').get<number>('rateLimitPerMinute', 30);
  const rateLimiter = createRateLimitMiddleware(rateLimitPerMin);
  middleware.use(rateLimiter);
  middleware.use(createTimingMiddleware(outputChannel));
  middleware.use(createUsageMiddleware(context.globalState));

  // --- 2d. Skapa dashboard ---
  const dashboard = new AgentDashboard(context.extensionUri);

  // --- 2e. Skapa guard rails ---
  const guardrailsConfig = vscode.workspace.getConfiguration('vscodeAgent.guardrails');
  let guardrailsEnabled = guardrailsConfig.get<boolean>('enabled', true);
  let guardrailsDryRun = guardrailsConfig.get<boolean>('dryRun', false);
  const guardrails = new GuardRails();

  // --- 2f. Skapa config manager ---
  const configManager = new ConfigManager();
  context.subscriptions.push({ dispose: () => configManager.dispose() });

  // --- 2g. Skapa status bar ---
  const statusBar = new AgentStatusBar();
  context.subscriptions.push(statusBar);

  // --- 2h. Skapa diff preview ---
  const diffPreview = new DiffPreview();
  context.subscriptions.push(diffPreview);

  // --- 2g2. Skapa snippet library ---
  const snippetLibrary = new SnippetLibrary(context.globalState);
  context.subscriptions.push(snippetLibrary);

  // --- 2g3. Skapa notification center ---
  let notificationsEnabled = vscode.workspace.getConfiguration('vscodeAgent.notifications').get<boolean>('enabled', true);
  const notifications = new NotificationCenter();
  context.subscriptions.push(notifications);

  // --- 2g4b. Skapa profil-manager ---
  const profileManager = new AgentProfileManager(context.globalState);
  context.subscriptions.push(profileManager);

  // Aktivera default-profil från settings
  const defaultProfile = vscode.workspace.getConfiguration('vscodeAgent').get<string>('defaultProfile', '');
  if (defaultProfile) {
    profileManager.activate(defaultProfile);
  }

  // --- 2g5. Skapa conversation persistence ---
  const conversationPersistence = new ConversationPersistence(context.globalState);
  context.subscriptions.push(conversationPersistence);

  // --- 2g6. Skapa telemetry engine ---
  let telemetryEnabled = vscode.workspace.getConfiguration('vscodeAgent').get<boolean>('telemetry.enabled', true);
  const telemetry = new TelemetryEngine(context.globalState);
  context.subscriptions.push(telemetry);

  // --- 2g7. Skapa external integrations ---
  const integrations = new ExternalIntegrations();
  context.subscriptions.push(integrations);

  // --- 2g4. Skapa context providers ---
  const contextProviders = new ContextProviderRegistry();
  context.subscriptions.push(contextProviders);

  // --- 2i. Skapa model selector ---
  const defaultModelSetting = vscode.workspace.getConfiguration('vscodeAgent.models').get<string>('default', 'auto');
  const modelSelector = new ModelSelector(
    defaultModelSetting !== 'auto' ? { default: { family: defaultModelSetting } } : undefined
  );
  context.subscriptions.push(modelSelector);

  // Uppdatera model selector vid config-ändringar
  configManager.onDidChange((config) => {
    // .agentrc.json kan definiera models-konfiguration
    const models = (config as any)?.models;
    if (models) {
      modelSelector.updateConfig(models);
    }
  });

  // --- 3. Skapa och registrera agenter ---
  const registry = new AgentRegistry();

  // Grundläggande agenter
  registry.register(new CodeAgent(tools));
  registry.register(new DocsAgent(tools));
  registry.register(new TaskAgent(sharedState));
  registry.register(new StatusAgent(sharedState));

  // Kodkvalitet & analys
  registry.register(new RefactorAgent(tools));
  registry.register(new ReviewAgent(tools));
  registry.register(new TestAgent(tools));
  registry.register(new DebugAgent(tools));

  // Prestanda & säkerhet
  registry.register(new SecurityAgent(tools));
  registry.register(new PerfAgent(tools));

  // Arkitektur & design
  registry.register(new ArchitectAgent(tools));
  registry.register(new ApiAgent(tools));

  // Konvertering & beroenden
  registry.register(new TranslateAgent(tools));
  registry.register(new DependencyAgent(tools));

  // Pedagogik
  registry.register(new ExplainAgent(tools, sharedState));

  // Git
  registry.register(new GitAgent());

  // 👾 Autonoma monsteragenter
  registry.register(new ScaffoldAgent());
  registry.register(new AutoFixAgent());
  registry.register(new DevOpsAgent());
  registry.register(new DatabaseAgent());
  registry.register(new MigrateAgent());
  registry.register(new ComponentAgent());
  registry.register(new I18nAgent());
  registry.register(new PlannerAgent(sharedState));
  registry.register(new A11yAgent());
  registry.register(new DocGenAgent());
  registry.register(new MetricsAgent());
  registry.register(new CliAgent());
  registry.register(new FullstackAgent());
  registry.register(new TestRunnerAgent());
  registry.register(new CreateAgentAgent());

  // Standardagenten är code
  registry.setDefault('code');

  // Injicera registret i alla agenter (för delegation/chaining)
  for (const agent of registry.list()) {
    agent.setRegistry(registry);
  }

  // Injicera minne i alla agenter (för remember/recall)
  for (const agent of registry.list()) {
    agent.setMemory(memory);
  }

  // Injicera modell-väljare i alla agenter (för per-agent modellval)
  for (const agent of registry.list()) {
    agent.setModelSelector(modelSelector);
  }

  // Injicera verktygsregistret i alla agenter (för fil/sök-verktyg)
  for (const agent of registry.list()) {
    agent.setTools(tools);
  }

  // Injicera DiffPreview i alla agenter (för förhandsgranskning av autonoma ändringar)
  for (const agent of registry.list()) {
    agent.setDiffPreview(diffPreview);
  }

  // --- 3a2. Profil deep-wiring: reagera på profilbyten ---
  profileManager.onDidChange((profile) => {
    if (profile) {
      // Wire guardLevel → guardrails-beteende
      if (profile.guardLevel === 'strict') {
        guardrailsEnabled = true;
        guardrailsDryRun = false;
      } else if (profile.guardLevel === 'relaxed') {
        guardrailsEnabled = false;
        guardrailsDryRun = false;
      } else {
        // 'normal' — återställ till settings-default
        const cfg = vscode.workspace.getConfiguration('vscodeAgent.guardrails');
        guardrailsEnabled = cfg.get<boolean>('enabled', true);
        guardrailsDryRun = cfg.get<boolean>('dryRun', false);
      }

      // Wire models → ModelSelector
      if (profile.models && Object.keys(profile.models).length > 0) {
        const modelConfig: Record<string, { family: string }> = {};
        for (const [category, model] of Object.entries(profile.models)) {
          modelConfig[category] = { family: model };
        }
        modelSelector.updateConfig(modelConfig);
      }

      // Wire middleware → MiddlewarePipeline
      if (profile.middleware && profile.middleware.length > 0) {
        middleware.clear();
        middleware.use(createRateLimitMiddleware(rateLimitPerMin));
        for (const mwName of profile.middleware) {
          if (mwName === 'timing') {
            middleware.use(createTimingMiddleware(outputChannel));
          } else if (mwName === 'usage') {
            middleware.use(createUsageMiddleware(context.globalState));
          } else if (mwName === 'logging') {
            middleware.use(createTimingMiddleware(outputChannel));
          } else {
            outputChannel.appendLine(`[Profile] Okänd middleware: ${mwName}`);
          }
        }
        outputChannel.appendLine(`[Profile] Middleware pipeline ombyggd: ${profile.middleware.join(', ')}`);
      }

      outputChannel.appendLine(`[Profile] Aktiverad: ${profile.icon} ${profile.name} (guard: ${profile.guardLevel ?? 'normal'})`);
    } else {
      // Profil avaktiverad — återställ till settings-default
      const cfg = vscode.workspace.getConfiguration('vscodeAgent.guardrails');
      guardrailsEnabled = cfg.get<boolean>('enabled', true);
      guardrailsDryRun = cfg.get<boolean>('dryRun', false);

      // Återställ middleware-pipeline till standard
      middleware.clear();
      middleware.use(createRateLimitMiddleware(rateLimitPerMin));
      middleware.use(createTimingMiddleware(outputChannel));
      middleware.use(createUsageMiddleware(context.globalState));

      outputChannel.appendLine('[Profile] Avaktiverad — standardinställningar återställda');
    }
  });

  // --- 3b. Skapa workflow-engine ---
  const workflowEngine = new WorkflowEngine(registry);

  // --- 3c. Skapa collaboration ---
  const collaboration = new AgentCollaboration(registry);

  // Forward-declare eventEngine (initieras i sektion 5d, men refereras i configManager callback)
  // eslint-disable-next-line prefer-const
  let eventEngine: EventDrivenEngine | undefined;

  // --- 3d. Koppla .agentrc.json-inställningar till subsystem ---
  configManager.onDidChange((config) => {
    // Uppdatera default-agent
    if (config.defaultAgent) {
      registry.setDefault(config.defaultAgent);
    }

    // Uppdatera guardrails-inställningar
    if (config.guardrails) {
      if (config.guardrails.dryRunDefault !== undefined) {
        guardrailsDryRun = config.guardrails.dryRunDefault;
        outputChannel.appendLine(`[Config] guardrails.dryRunDefault = ${config.guardrails.dryRunDefault}`);
      }
    }

    // Uppdatera minnesinställningar
    if (config.memory) {
      if (config.memory.maxAge || config.memory.maxCount) {
        memory.prune({
          maxAge: config.memory.maxAge,
          maxCount: config.memory.maxCount,
        });
      }
    }

    // Registrera custom event-regler
    if (config.eventRules && eventEngine) {
      for (const rule of config.eventRules) {
        eventEngine.addRule({
          id: `config-${rule.agentId}-${rule.event}`,
          event: rule.event as 'onSave' | 'onDiagnostics' | 'onFileCreate' | 'onFileDelete' | 'onInterval',
          agentId: rule.agentId,
          prompt: rule.prompt ?? '',
          filePattern: rule.filePattern,
          enabled: rule.enabled ?? true,
        });
      }
    }

    // Registrera custom workflows
    if (config.workflows) {
      workflowEngine.clearWorkflows();
      for (const [name, wf] of Object.entries(config.workflows)) {
        workflowEngine.registerWorkflow(name, {
          name,
          description: wf.description ?? `Custom workflow: ${name}`,
          steps: wf.steps.map((s) => ({
            name: s.agentId,
            agentId: s.agentId,
            prompt: s.prompt ?? `Kör ${s.agentId}-agenten.`,
            pipeOutput: s.pipeOutput,
          })),
        });
      }
      outputChannel.appendLine(`[Config] Registrerade ${Object.keys(config.workflows).length} custom workflows`);
    }

    // Ladda om integrations-konfiguration
    if ((config as any).integrations) {
      integrations.reload((config as any).integrations);
      outputChannel.appendLine('[Config] External integrations omladdade');
    }

    outputChannel.appendLine(`[Config] .agentrc.json uppdaterad: ${JSON.stringify(Object.keys(config))}`);
  });

  // Kolla disabledAgents vid start (initialt laddad config)
  const initialConfig = configManager.current;
  if (initialConfig.disabledAgents && initialConfig.disabledAgents.length > 0) {
    outputChannel.appendLine(`[Config] Inaktiverade agenter: ${initialConfig.disabledAgents.join(', ')}`);
  }
  if (initialConfig.defaultAgent) {
    registry.setDefault(initialConfig.defaultAgent);
  }
  // Ladda initiala custom workflows
  if (initialConfig.workflows) {
    for (const [name, wf] of Object.entries(initialConfig.workflows)) {
      workflowEngine.registerWorkflow(name, {
        name,
        description: wf.description ?? `Custom workflow: ${name}`,
        steps: wf.steps.map((s) => ({
          name: s.agentId,
          agentId: s.agentId,
          prompt: s.prompt ?? `Kör ${s.agentId}-agenten.`,
          pipeOutput: s.pipeOutput,
        })),
      });
    }
    outputChannel.appendLine(`[Config] Laddade ${Object.keys(initialConfig.workflows).length} initiala custom workflows`);
  }

  // --- 4. Chat Request Handler ---
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    const ctx: AgentContext = { request, chatContext, stream, token };

    let agent: import('./agents/base-agent').BaseAgent | undefined;

    // Inbyggda workflow-kommandon
    if (request.command === 'workflow-quality') {
      const results = await workflowEngine.run(WorkflowEngine.qualityCheck(), ctx);
      return { metadata: { command: 'workflow', steps: results.length } };
    }
    if (request.command === 'workflow-ship') {
      const results = await workflowEngine.run(
        WorkflowEngine.shipFeature(request.prompt || 'ny feature'),
        ctx
      );
      return { metadata: { command: 'workflow', steps: results.length } };
    }
    if (request.command === 'workflow-fix') {
      const results = await workflowEngine.run(WorkflowEngine.fixAndVerify(), ctx);
      return { metadata: { command: 'workflow', steps: results.length } };
    }
    if (request.command === 'workflow-run') {
      // Kör en namngiven custom workflow från .agentrc.json
      const workflowName = request.prompt.trim();
      const available = workflowEngine.listWorkflows();

      if (!workflowName || workflowName === 'list') {
        if (available.length === 0) {
          stream.markdown('📋 Inga custom workflows registrerade.\n\nLägg till workflows i `.agentrc.json`.');
        } else {
          stream.markdown(`📋 **Tillgängliga custom workflows:**\n\n${available.map(n => `- \`${n}\``).join('\n')}\n\nAnvänd: \`/workflow-run <namn>\``);
        }
        return { metadata: { command: 'workflow-run', listed: true } };
      }

      const wf = workflowEngine.getWorkflow(workflowName);
      if (!wf) {
        stream.markdown(`❌ Workflow \`${workflowName}\` hittades inte.\n\nTillgängliga: ${available.join(', ') || '(inga)'}`);
        return { metadata: { command: 'workflow-run', notFound: workflowName } };
      }

      const results = await workflowEngine.run(wf, ctx);
      return { metadata: { command: 'workflow-run', workflow: workflowName, steps: results.length } };
    }

    // Collaboration-kommandon
    if (request.command === 'collab-vote') {
      const agentIds = (request.prompt || 'code,review,security').split(',').map((s) => s.trim());
      const result = await collaboration.vote(agentIds, ctx);
      return { metadata: { command: 'collab-vote', winner: result.winner?.agentId } };
    }
    if (request.command === 'collab-debate') {
      const agentIds = (request.prompt || 'code,architect,review').split(',').map((s) => s.trim());
      const result = await collaboration.debate(agentIds, ctx);
      return { metadata: { command: 'collab-debate', winner: result.winner?.agentId } };
    }
    if (request.command === 'collab-consensus') {
      const agentIds = (request.prompt || 'code,review,security,perf').split(',').map((s) => s.trim());
      const result = await collaboration.consensus(agentIds, ctx);
      return { metadata: { command: 'collab-consensus', agreement: result.agreementLevel } };
    }
    if (request.command === 'collab-review') {
      const agentIds = (request.prompt || 'code,review,security').split(',').map((s) => s.trim());
      const result = await collaboration.reviewChain(agentIds, ctx);
      return { metadata: { command: 'collab-review', steps: result.votes.length } };
    }

    if (request.command) {
      // Slash-kommando: direkt routing
      agent = registry.resolve(ctx);
    } else {
      // Inget slash-kommando: använd smart auto-router (LLM-baserad)
      stream.progress('🧠 Analyserar meddelande...');

      // Samla routing-options: profil + telemetri
      const activeProfile = profileManager.active;
      const routeOptions: {
        profileAgents?: string[];
        telemetryStats?: Record<string, { successRate: number; avgDurationMs: number }>;
      } = {};

      if (activeProfile) {
        routeOptions.profileAgents = activeProfile.agents;
      }

      if (telemetryEnabled) {
        const stats = telemetry.agentStats();
        const telemetryStats: Record<string, { successRate: number; avgDurationMs: number }> = {};
        for (const [id, s] of Object.entries(stats)) {
          if (s.calls >= 3) { // Bara agenter med tillräcklig data
            telemetryStats[id] = {
              successRate: Math.round((s.successCount / s.calls) * 100),
              avgDurationMs: s.avgDurationMs,
            };
          }
        }
        if (Object.keys(telemetryStats).length > 0) {
          routeOptions.telemetryStats = telemetryStats;
        }
      }

      agent = await registry.smartRoute(ctx, routeOptions);
    }

    // Kontrollera om agenten är inaktiverad via .agentrc.json
    if (agent && configManager.isDisabled(agent.id)) {
      stream.markdown(`⚠️ Agent \`${agent.id}\` är inaktiverad i .agentrc.json (disabledAgents).`);
      return { metadata: { command: request.command ?? 'default', disabled: true } };
    }

    // Injicera custom system-prompt från .agentrc.json om det finns
    const customPrompt = configManager.getPrompt(agent?.id ?? '');
    if (customPrompt && agent) {
      // Lägg till som prefix i workspaceContext — agents läser det automatiskt
      ctx.workspaceContext = `[Custom systeminstruktion]\n${customPrompt}\n\n${ctx.workspaceContext ?? ''}`;
    }

    if (!agent) {
      // Fallback: använd router-prompten direkt
      stream.markdown('Jag kunde inte hitta en passande agent. Tillgängliga kommandon:\n\n' +
        '**Grundläggande:** `/code` `/docs` `/task` `/status`\n' +
        '**Kodkvalitet:** `/refactor` `/review` `/test` `/debug`\n' +
        '**Prestanda & Säkerhet:** `/perf` `/security`\n' +
        '**Arkitektur:** `/architect` `/api`\n' +
        '**Övrigt:** `/translate` `/deps` `/explain` `/git`\n' +
        '**👾 Autonoma:** `/scaffold` `/autofix` `/devops` `/db` `/migrate`\n' +
        '**👾 Autonoma:** `/component` `/i18n` `/plan` `/a11y` `/docgen` `/metrics` `/cli` `/fullstack`\n' +
        '**🧪 Testning:** `/testrunner`\n' +
        '**🧬 Meta:** `/create-agent`\n' +
        '**🤝 Collaboration:** `/collab-vote` `/collab-debate` `/collab-consensus` `/collab-review`');
      return;
    }

    let dashId = '';
    let lastCheckpoint: import('./guardrails').Checkpoint | undefined;

    // Cache: check for cached response
    if (cacheEnabled && request.command) {
      const cacheKey = ResponseCache.makeKey(request.prompt, request.command, agent.id);
      const cached = responseCache.get(cacheKey);
      if (cached) {
        stream.markdown(cached);
        stream.markdown('\n\n---\n*📦 Cachat svar*');
        statusBar.updateCache(responseCache.stats);
        return { metadata: { command: request.command, cached: true } };
      }
    }

    // GuardRails: skapa checkpoint för autonoma agenter
    // Bekräftelse innan autonoma agenter körs
    const confirmBeforeApply = vscode.workspace.getConfiguration('vscodeAgent.autonomous').get<boolean>('confirmBeforeApply', true);
    if (agent.isAutonomous && confirmBeforeApply) {
      const choice = await vscode.window.showWarningMessage(
        `Agent "${agent.name}" kommer att göra ändringar i arbetsytan. Fortsätta?`,
        { modal: false },
        'Kör',
        'Dry-run'
      );
      if (!choice) {
        stream.markdown('⚠️ Avbruten av användaren.');
        return { metadata: { command: request.command ?? 'default', cancelled: true } };
      }
      if (choice === 'Dry-run') {
        guardrails.dryRun([{ action: 'run', target: agent.id, detail: request.prompt }], stream);
        stream.markdown('👁️ **Dry-run:** Inga ändringar gjordes. Se output-panelen för detaljer.');
        return { metadata: { command: request.command ?? 'default', dryRun: true } };
      }
    }

    // Starta timer EFTER bekräftelsedialog (exkludera väntetid från telemetri)
    const _startTime = Date.now();

    if (guardrailsEnabled && agent.isAutonomous) {
      if (guardrailsDryRun) {
        guardrails.dryRun([{ action: 'run', target: agent.id, detail: request.prompt }], stream);
        return { metadata: { command: request.command ?? 'default', dryRun: true } };
      }
      // Skapa checkpoint innan autonomt körning
      try {
        lastCheckpoint = await guardrails.createCheckpoint(agent.id, `Innan /${agent.id}: ${request.prompt.slice(0, 50)}`, []);
        if (notificationsEnabled) {
          notifications.notify(
            agent.id,
            agent.name,
            'info',
            `Checkpoint skapad innan /${agent.id}`,
            { actions: [{ label: 'Visa Dashboard', command: 'vscode-agent.showDashboard' }] }
          );
        }
      } catch (checkpointError) {
        outputChannel.appendLine(`[GuardRails] Checkpoint creation skipped: ${checkpointError}`);
      }
    }

    try {
      // Dashboard: logga start
      dashId = dashboard.logStart(agent.id, agent.name, request.prompt);

      // Status bar: markera aktiv
      statusBar.setActive(agent.id, agent.name);

      // Conversation: spara användarmeddelande
      await conversationPersistence.addMessage({
        role: 'user',
        content: request.prompt,
        command: request.command,
        timestamp: Date.now(),
      });

      // Injicera arbetsytekontext automatiskt (git diff, diagnostik, etc.)
      try {
        const workspaceContext = await contextProviders.buildPromptContext(2000);
        // Lägg till konversationshistorik om det finns
        const conversationContext = conversationPersistence.buildConversationContext(8, 2000);
        // Lägg till agentminne-kontext om det finns
        const memoryContext = memory.buildContextWindow(agent.id, request.prompt, 500);
        let combined = workspaceContext;
        if (conversationContext) {
          combined += `\n\n${conversationContext}`;
        }
        if (memoryContext) {
          combined += `\n\n${memoryContext}`;
        }
        ctx.workspaceContext = combined;
      } catch {
        // Degrade gracefully if context gathering fails
        ctx.workspaceContext = '';
      }

      // Kör genom middleware-pipeline (timing, rate-limit, usage)
      // Wrap stream to capture agent output for caching
      const [captureStream, getCapturedText] = createCaptureStream(stream);
      const captureCtx: AgentContext = { ...ctx, stream: captureStream };

      // Wrap autonoma agenter med progress-notis
      let result: import('./agents/base-agent').AgentResult;
      if (agent.isAutonomous && notificationsEnabled) {
        result = await notifications.withProgress(
          agent.name,
          async (progress) => {
            progress.report({ message: 'Kör...' });
            return middleware.execute(agent!, captureCtx);
          }
        );
      } else {
        result = await middleware.execute(agent, captureCtx);
      }

      // DiffPreview: om autonoma agenten samlade ändringar, visa förhandsgranskning
      if (agent.isAutonomous && diffPreview.count > 0) {
        const diffResult = await diffPreview.reviewAndApply(stream);
        outputChannel.appendLine(
          `[DiffPreview] ${diffResult.applied} applicerade, ${diffResult.rejected} avvisade`
        );
        diffPreview.clear();
      }

      // GuardRails: populera checkpoint med filer som påverkades
      if (lastCheckpoint && result?.metadata?.filesAffected) {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (ws) {
          const createdUris = (result.metadata.filesAffected as string[])
            .map(f => vscode.Uri.joinPath(ws.uri, f));
          guardrails.markCreated(lastCheckpoint.id, createdUris);
        }
      }

      // Dashboard: logga slut
      dashboard.logEnd(dashId, true);

      // Status bar: markera idle
      statusBar.setIdle(true);

      // Uppdatera minnesräknare i status bar
      statusBar.updateMemory(memory.stats().totalMemories);

      // Uppdatera cache-räknare i status bar
      statusBar.updateCache(responseCache.stats);

      // Cache: spara lyckat svar för framtida cache-hits
      const agentResponseText = getCapturedText();
      if (cacheEnabled && request.command && agentResponseText) {
        const cacheKey = ResponseCache.makeKey(request.prompt, request.command, agent.id);
        await responseCache.set(cacheKey, agentResponseText, { agentId: agent.id });
      }

      // Memory: spara kontextsammanfattning om agenten flaggar det
      // (undvik att fylla minnet med brus från varje anrop)
      if (agentResponseText && result?.metadata?.remember !== false) {
        const minLength = 100;
        if (agentResponseText.length >= minLength) {
          memory.remember(
            agent.id,
            agentResponseText.slice(0, 500),
            {
              type: 'context',
              tags: [request.command ?? 'auto', agent.id],
            }
          );
        }
      }

      // Telemetri: logga framgång
      if (telemetryEnabled) {
        await telemetry.log({
          agentId: agent.id,
          agentName: agent.name,
          command: request.command ?? 'auto',
          timestamp: Date.now(),
          durationMs: Date.now() - _startTime,
          success: true,
          promptLength: request.prompt.length,
        });
      }

      // Conversation: spara faktiskt agent-svar (max 10 000 tecken)
      await conversationPersistence.addMessage({
        role: 'assistant',
        content: agentResponseText
          ? agentResponseText.slice(0, 10_000)
          : `[Agent: ${agent.id}] svarade (inget fångat)`,
        agentId: agent.id,
        command: request.command,
        timestamp: Date.now(),
      });

      // Notifiera om framgång
      if (notificationsEnabled) {
        notifications.notifyAgentDone(
          agent.id,
          agent.name,
          true
        );
      }

      // Spara-snippet knapp
      stream.button({
        command: 'vscode-agent.saveSnippet',
        title: '📋 Spara som snippet',
        arguments: [agent.id, request.prompt, agentResponseText],
      });

      // Integrations-knapp
      stream.button({
        command: 'vscode-agent.createExternalIssue',
        title: '📤 Rapportera externt',
        arguments: [agent.id, request.prompt],
      });

      // Returnera uppföljningsförslag om agenten gav sådana
      if (result.followUps && result.followUps.length > 0) {
        return {
          metadata: { command: request.command ?? 'default', followUps: result.followUps },
        };
      }

      return { metadata: { command: request.command ?? 'default' } };
    } catch (error) {
      // Dashboard: logga fel
      dashboard.logEnd(dashId, false, String(error));

      // Status bar: markera fel
      statusBar.setIdle(false);

      // Telemetri: logga fel
      if (telemetryEnabled) {
        await telemetry.log({
          agentId: agent?.id ?? 'unknown',
          agentName: agent?.name ?? 'Unknown',
          command: request.command ?? 'auto',
          timestamp: Date.now(),
          durationMs: Date.now() - _startTime,
          success: false,
          error: String(error),
          promptLength: request.prompt.length,
        });
      }

      // Notifiera om fel
      if (notificationsEnabled) {
        notifications.notifyAgentDone(
          agent?.id ?? 'unknown',
          agent?.name ?? 'Unknown',
          false,
          String(error)
        );
      }

      if (error instanceof vscode.LanguageModelError) {
        stream.markdown(`⚠️ Språkmodellfel: ${error.message}`);
      } else if (error instanceof Error) {
        stream.markdown(`❌ Ett oväntat fel inträffade: ${error.message}`);
      } else {
        stream.markdown(`❌ Ett oväntat fel inträffade: ${String(error)}`);
      }
      return { metadata: { command: 'error' } };
    }
  };

  // --- 5. Registrera Chat Participant ---
  const participant = vscode.chat.createChatParticipant(
    'vscode-agent.agent',
    handler
  );

  participant.iconPath = new vscode.ThemeIcon('hubot');

  // Hantera uppföljningsförslag
  participant.followupProvider = {
    provideFollowups(
      result: vscode.ChatResult,
      _context: vscode.ChatContext,
      _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.ChatFollowup[]> {
      // Hämta followUps från metadata
      return (result.metadata as any)?.followUps ?? [];
    },
  };

  context.subscriptions.push(participant);

  // --- 5b. Registrera TreeView (sidopanel) ---
  const treeProvider = new AgentTreeProvider(registry, context.globalState);
  const treeView = vscode.window.createTreeView('agentExplorer', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Visa sidopanelen vid start om konfigurerat
  const showSidebarOnStartup = vscode.workspace.getConfiguration('vscodeAgent.sidebar').get<boolean>('showOnStartup', false);
  if (showSidebarOnStartup) {
    vscode.commands.executeCommand('agentExplorer.focus');
  }

  // --- 5c. Registrera CodeLens ---
  let codeLensEnabled = vscode.workspace.getConfiguration('vscodeAgent.codeLens').get<boolean>('enabled', true);
  const codeLensProvider = new AgentCodeLensProvider();
  codeLensProvider.setEnabled(codeLensEnabled);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { language: 'typescript' },
        { language: 'typescriptreact' },
        { language: 'javascript' },
        { language: 'javascriptreact' },
        { language: 'python' },
      ],
      codeLensProvider
    )
  );

  // --- 5d. Starta event-driven engine ---
  eventEngine = new EventDrivenEngine(registry, context.globalState);

  // Registrera fördefinierade regler (disabled by default — aktiveras via settings)
  const eventConfig = vscode.workspace.getConfiguration('vscodeAgent.events');
  const defaultRules = [
    EventDrivenEngine.autoFixOnSave(),
    EventDrivenEngine.securityOnNewFile(),
    EventDrivenEngine.docsOnErrors(),
  ];
  for (const rule of defaultRules) {
    // Aktivera bara om explicit aktiverad i settings
    rule.enabled = eventConfig.get<boolean>(`${rule.id}.enabled`, false);
    eventEngine.addRule(rule);
  }

  eventEngine.activate();
  context.subscriptions.push({ dispose: () => eventEngine.dispose() });

  // --- 5d2. Prenumerera på event-triggers → NotificationCenter ---
  eventEngine.onDidTrigger((e) => {
    if (notificationsEnabled) {
      notifications.notify(
        e.agentId,
        e.agentId,
        'info',
        `Event-regel "${e.ruleId}" triggade agenten (${e.event})`,
        {
          actions: [
            { label: 'Visa Dashboard', command: 'vscode-agent.showDashboard' },
          ],
        }
      );
    }
  });

  // --- 5d3. Live settings reload ---
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('vscodeAgent')) {
        const cfg = vscode.workspace.getConfiguration('vscodeAgent');

        // Rate limit
        if (e.affectsConfiguration('vscodeAgent.rateLimitPerMinute')) {
          rateLimitPerMin = cfg.get<number>('rateLimitPerMinute', 30);
          rateLimiter.updateLimit(rateLimitPerMin);
          outputChannel.appendLine(`[Settings] rateLimitPerMinute = ${rateLimitPerMin}`);
        }

        // Guardrails
        if (e.affectsConfiguration('vscodeAgent.guardrails')) {
          const grCfg = vscode.workspace.getConfiguration('vscodeAgent.guardrails');
          guardrailsEnabled = grCfg.get<boolean>('enabled', true);
          guardrailsDryRun = grCfg.get<boolean>('dryRun', false);
          outputChannel.appendLine(`[Settings] guardrails: enabled=${guardrailsEnabled}, dryRun=${guardrailsDryRun}`);
        }

        // Notifications
        if (e.affectsConfiguration('vscodeAgent.notifications')) {
          notificationsEnabled = vscode.workspace.getConfiguration('vscodeAgent.notifications').get<boolean>('enabled', true);
          outputChannel.appendLine(`[Settings] notifications.enabled = ${notificationsEnabled}`);
        }

        // Telemetry
        if (e.affectsConfiguration('vscodeAgent.telemetry')) {
          telemetryEnabled = cfg.get<boolean>('telemetry.enabled', true);
          outputChannel.appendLine(`[Settings] telemetry.enabled = ${telemetryEnabled}`);
        }

        // Cache
        if (e.affectsConfiguration('vscodeAgent.cache')) {
          const cacheCfg = vscode.workspace.getConfiguration('vscodeAgent.cache');
          cacheEnabled = cacheCfg.get<boolean>('enabled', true);
          outputChannel.appendLine(`[Settings] cache.enabled = ${cacheEnabled}`);
        }

        // CodeLens
        if (e.affectsConfiguration('vscodeAgent.codeLens')) {
          codeLensEnabled = vscode.workspace.getConfiguration('vscodeAgent.codeLens').get<boolean>('enabled', true);
          codeLensProvider.setEnabled(codeLensEnabled);
          outputChannel.appendLine(`[Settings] codeLens.enabled = ${codeLensEnabled}`);
        }

        // Locale
        if (e.affectsConfiguration('vscodeAgent.locale')) {
          const locale = cfg.get<string>('locale', 'auto');
          if (locale === 'auto') {
            initI18n();
          } else {
            setLocale(locale as Locale);
          }
          outputChannel.appendLine(`[Settings] locale = ${locale}`);
        }
      }
    })
  );

  // --- 5e. Skapa marketplace ---
  const marketplace = new AgentMarketplace(
    context.globalState,
    (pluginData) => {
      // On install: plugin-filen skrivs av marketplace till .agent-plugins/,
      // FileSystemWatcher i pluginLoader registrerar agenten automatiskt.
      outputChannel.appendLine(`Marketplace: installerad: ${pluginData?.id ?? 'unknown'}`);
      treeProvider.refresh();
    },
    (agentId) => {
      // On uninstall: marketplace tar bort filen, watcher hanterar avregistrering.
      // Fallback: avregistrera direkt om watcher missar det.
      outputChannel.appendLine(`Marketplace: avinstallerad: ${agentId}`);
      registry.unregister(agentId);
      treeProvider.refresh();
    }
  );
  context.subscriptions.push(marketplace);

  // --- 5f. Ladda plugin-system ---
  const pluginLoader = new PluginLoader(
    (agent) => {
      registry.register(agent);
      agent.setRegistry(registry);
      agent.setMemory(memory);
      agent.setModelSelector(modelSelector);
      agent.setTools(tools);
      agent.setDiffPreview(diffPreview);
      treeProvider.refresh();
      statusBar.updatePlugins(pluginLoader.listPlugins().length);
    },
    (agentId) => {
      registry.unregister(agentId);
      treeProvider.refresh();
      outputChannel.appendLine(`Plugin avregistrerad: ${agentId}`);
      statusBar.updatePlugins(pluginLoader.listPlugins().length);
    }
  );
  pluginLoader.activate().then((plugins) => {
    if (plugins.length > 0) {
      outputChannel.appendLine(`Laddade ${plugins.length} plugins`);
      statusBar.updatePlugins(plugins.length);
    }
  }).catch((err) => {
    outputChannel.appendLine(`Plugin-laddning misslyckades: ${err}`);
  });
  context.subscriptions.push(pluginLoader);

  // --- 6. Registrera kommandon ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.clearState', () => {
      sharedState.clear();
      vscode.window.showInformationMessage('Agent: Delat tillstånd rensat.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.showState', () => {
      const state = sharedState.getAll();
      const stateJson = JSON.stringify(state, null, 2);

      vscode.workspace
        .openTextDocument({ content: stateJson, language: 'json' })
        .then((doc) => vscode.window.showTextDocument(doc));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.showDashboard', () => {
      dashboard.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.showMemory', () => {
      const stats = memory.stats();
      const statsJson = JSON.stringify(stats, null, 2);

      vscode.workspace
        .openTextDocument({ content: statsJson, language: 'json' })
        .then((doc) => vscode.window.showTextDocument(doc));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.clearMemory', () => {
      const count = memory.prune({ maxAge: 0 });
      vscode.window.showInformationMessage(`Agent: Rensade ${count} minnen.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.initConfig', () => {
      configManager.createDefault();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.toggleCodeLens', () => {
      codeLensProvider.setEnabled(
        !codeLensProvider.isEnabled()
      );
      vscode.window.showInformationMessage('Agent: CodeLens togglad.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.undo', async () => {
      const result = await guardrails.undo();
      if (result) {
        vscode.window.showInformationMessage(
          `Agent: Undo klar — ${result.restoredFiles} filer återställda.`
        );
      } else {
        vscode.window.showWarningMessage('Agent: Inga checkpoints att ångra.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.refreshTree', () => {
      treeProvider.refresh();
    })
  );

  // --- Nya kommandon: Plugins, Models, Diff ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.createPlugin', async () => {
      const id = await vscode.window.showInputBox({
        prompt: 'Plugin-ID (slug, t.ex. "my-agent")',
        placeHolder: 'my-agent',
        validateInput: (v) =>
          /^[a-z0-9-]+$/.test(v) ? null : 'Använd bara a-z, 0-9, bindestreck',
      });
      if (!id) { return; }

      const name = await vscode.window.showInputBox({
        prompt: 'Plugin-namn',
        placeHolder: 'My Custom Agent',
      });
      if (!name) { return; }

      const uri = await pluginLoader.createPlugin(id, name);
      if (uri) {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(
          `🔌 Plugin "${name}" skapad! Redigera JSON-filen och den hot-reloadas automatiskt.`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.showModels', async () => {
      const info = modelSelector.describeModelAssignments();
      const available = await modelSelector.listAvailableModels();
      const modelList = available.map((m) => `- ${m.name} (${m.id})`).join('\n');

      const content = `${info}\n\n## Tillgängliga modeller\n${modelList}`;
      const doc = await vscode.workspace.openTextDocument({
        content,
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.previewDiff', () => {
      if (diffPreview.count === 0) {
        vscode.window.showInformationMessage('Inga väntande ändringar att förhandsgranska.');
        return;
      }
      diffPreview.showPreview();
    })
  );

  // --- Snippet-kommandon ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.saveSnippet', async (agentId?: string, prompt?: string, agentContent?: string) => {
      // Använd agent-svaret om det skickades från knappen, annars editor-text
      let content = agentContent ?? '';
      if (!content) {
        const editor = vscode.window.activeTextEditor;
        content = editor?.document.getText(editor.selection.isEmpty ? undefined : editor.selection) ?? '';
      }
      await snippetLibrary.quickSave(
        agentId ?? 'unknown',
        prompt ?? 'manuell',
        content
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.showSnippets', () => {
      snippetLibrary.showLibrary();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.insertSnippet', () => {
      snippetLibrary.pickAndInsert();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.exportSnippets', () => {
      snippetLibrary.exportSnippets();
    })
  );

  // --- Notification-kommandon ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.showNotifications', () => {
      notifications.showHistory();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.clearNotifications', () => {
      notifications.clearHistory();
      vscode.window.showInformationMessage('Agent: Notifieringar rensade.');
    })
  );

  // --- Profile-kommandon ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.switchProfile', () => {
      profileManager.showPicker();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.createProfile', () => {
      profileManager.showCreateWizard();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.exportProfile', async () => {
      const active = profileManager.active;
      if (active) {
        await profileManager.exportProfile(active.id);
      } else {
        vscode.window.showInformationMessage('Ingen aktiv profil att exportera.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.importProfile', () => {
      profileManager.importProfile();
    })
  );

  // --- Conversation-kommandon ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.showConversations', () => {
      conversationPersistence.showPicker();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.saveConversation', () => {
      conversationPersistence.saveCurrentAs();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.newConversation', () => {
      conversationPersistence.startNew();
    })
  );

  // --- Telemetry-kommandon ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.showAnalytics', () => {
      telemetry.show(context.extensionUri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.clearTelemetry', async () => {
      await telemetry.clear();
      vscode.window.showInformationMessage('Agent: Telemetri rensad.');
    })
  );

  // --- Integration-kommandon ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.createExternalIssue', (agentId?: string, prompt?: string) => {
      integrations.createIssueInteractive(
        agentId ?? 'unknown',
        prompt ?? '',
        `Genererat av VS Code Agent via /${agentId}`
      );
    })
  );

  // --- Marketplace-kommandon ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.showMarketplace', () => {
      marketplace.showBrowser();
    })
  );

  // --- Health Check kommando ---
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-agent.healthCheck', async () => {
      const cacheStats = responseCache.stats;
      const memStats = memory.stats();
      const agentCount = registry.list().length;
      const pluginCount = pluginLoader.listPlugins().length;
      const activeProfile = profileManager.active;

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        agents: { registered: agentCount, default: 'code' },
        plugins: { loaded: pluginCount },
        cache: cacheStats,
        memory: memStats,
        profile: activeProfile?.id ?? 'none',
        guardrails: { enabled: guardrailsEnabled, dryRun: guardrailsDryRun },
        rateLimit: { perMinute: rateLimitPerMin },
        locale: vscode.workspace.getConfiguration('vscodeAgent').get<string>('locale', 'auto'),
      };

      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(health, null, 2),
        language: 'json',
      });
      await vscode.window.showTextDocument(doc);
    })
  );

  // --- 7. Lyssna på tillståndsändringar (logga i output) ---

  sharedState.onDidChange(({ key, value }) => {
    outputChannel.appendLine(
      `[${new Date().toISOString()}] Tillstånd ändrat: ${key} = ${JSON.stringify(value)}`
    );
  });

  // Cleanup
  context.subscriptions.push({
    dispose: () => {
      sharedState.dispose();
      dashboard.dispose();
      statusBar.dispose();
      diffPreview.dispose();
      modelSelector.dispose();
      pluginLoader.dispose();
      snippetLibrary.dispose();
      notifications.dispose();
      contextProviders.dispose();
      profileManager.dispose();
      conversationPersistence.dispose();
      telemetry.dispose();
      integrations.dispose();
      marketplace.dispose();
      memory.dispose();
      guardrails.dispose();
    },
  });

  outputChannel.appendLine(
    `VS Code Agent aktiverad (fönster-ID: ${sharedState.windowId})`
  );
}

export function deactivate() {
  // Cleanup hanteras av subscriptions
}
