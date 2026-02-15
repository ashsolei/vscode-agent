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
  const cacheEnabled = cacheConfig.get<boolean>('enabled', true);

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
  const rateLimitPerMin = vscode.workspace.getConfiguration('vscodeAgent').get<number>('rateLimitPerMinute', 30);
  middleware.use(createRateLimitMiddleware(rateLimitPerMin));
  middleware.use(createTimingMiddleware(outputChannel));
  middleware.use(createUsageMiddleware(context.globalState));

  // --- 2d. Skapa dashboard ---
  const dashboard = new AgentDashboard(context.extensionUri);

  // --- 2e. Skapa guard rails ---
  const guardrailsConfig = vscode.workspace.getConfiguration('vscodeAgent.guardrails');
  const guardrailsEnabled = guardrailsConfig.get<boolean>('enabled', true);
  const guardrailsDryRun = guardrailsConfig.get<boolean>('dryRun', false);
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
  const notificationsEnabled = vscode.workspace.getConfiguration('vscodeAgent.notifications').get<boolean>('enabled', true);
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
  const telemetryEnabled = vscode.workspace.getConfiguration('vscodeAgent').get<boolean>('telemetry.enabled', true);
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

  // --- 3b. Skapa workflow-engine ---
  const workflowEngine = new WorkflowEngine(registry);

  // --- 3c. Skapa collaboration ---
  const collaboration = new AgentCollaboration(registry);

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

    if (request.command) {
      // Slash-kommando: direkt routing
      agent = registry.resolve(ctx);
    } else {
      // Inget slash-kommando: använd smart auto-router (LLM-baserad)
      stream.progress('🧠 Analyserar meddelande...');
      agent = await registry.smartRoute(ctx);
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
        '**🤝 Collaboration:** `/collab-vote` `/collab-debate` `/collab-consensus`');
      return;
    }

    const _startTime = Date.now();
    let dashId = '';

    // Cache: check for cached response
    if (cacheEnabled && request.command) {
      const cacheKey = ResponseCache.makeKey(request.prompt, request.command);
      const cached = responseCache.get(cacheKey);
      if (cached) {
        stream.markdown(cached);
        stream.markdown('\n\n---\n*📦 Cachat svar*');
        statusBar.updateCache(responseCache.stats);
        return { metadata: { command: request.command, cached: true } };
      }
    }

    // GuardRails: skapa checkpoint för autonoma agenter
    if (guardrailsEnabled && agent.isAutonomous) {
      if (guardrailsDryRun) {
        guardrails.dryRun([{ action: 'run', target: agent.id, detail: request.prompt }]);
        return { metadata: { command: request.command ?? 'default', dryRun: true } };
      }
      // Skapa checkpoint innan autonomt körning
      try {
        await guardrails.createCheckpoint(agent.id, `Innan /${agent.id}: ${request.prompt.slice(0, 50)}`, []);
      } catch {
        // Ingen workspace — hoppa över checkpoint
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
        ctx.workspaceContext = workspaceContext;
      } catch {
        // Degrade gracefully if context gathering fails
        ctx.workspaceContext = '';
      }

      // Kör genom middleware-pipeline (timing, rate-limit, usage)
      // Wrap stream to capture agent output for caching
      let agentResponseText = '';
      const captureStream = new Proxy(stream, {
        get(target, prop) {
          if (prop === 'markdown') {
            return (value: string | vscode.MarkdownString) => {
              const text = typeof value === 'string' ? value : value.value;
              agentResponseText += text;
              target.markdown(value);
            };
          }
          return Reflect.get(target, prop);
        },
      });
      const captureCtx: AgentContext = { ...ctx, stream: captureStream };
      const result = await middleware.execute(agent, captureCtx);

      // Dashboard: logga slut
      dashboard.logEnd(dashId, true);

      // Status bar: markera idle
      statusBar.setIdle(true);

      // Uppdatera minnesräknare i status bar
      statusBar.updateMemory(memory.stats().totalMemories);

      // Uppdatera cache-räknare i status bar
      statusBar.updateCache(responseCache.stats);

      // Cache: spara lyckat svar för framtida cache-hits
      // Note: We cache a summary marker — full response caching is not possible
      // since agent output is streamed directly to the chat UI.
      if (cacheEnabled && request.command && agentResponseText) {
        const cacheKey = ResponseCache.makeKey(request.prompt, request.command);
        await responseCache.set(cacheKey, agentResponseText, { agentId: agent.id });
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

      // Conversation: spara agent-svar
      await conversationPersistence.addMessage({
        role: 'assistant',
        content: `[Agent: ${agent.id}] svarade på: ${request.prompt.slice(0, 100)}`,
        agentId: agent.id,
        command: request.command,
        timestamp: Date.now(),
      });

      // Spara-snippet knapp
      stream.button({
        command: 'vscode-agent.saveSnippet',
        title: '📋 Spara som snippet',
        arguments: [agent.id, request.prompt],
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
      } else {
        stream.markdown(`❌ Ett oväntat fel inträffade: ${error}`);
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
  const codeLensEnabled = vscode.workspace.getConfiguration('vscodeAgent.codeLens').get<boolean>('enabled', true);
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
  const eventEngine = new EventDrivenEngine(registry, context.globalState);
  eventEngine.activate();
  context.subscriptions.push({ dispose: () => eventEngine.dispose() });

  // --- 5e. Skapa marketplace ---
  const marketplace = new AgentMarketplace(
    context.globalState,
    (pluginData) => {
      // On install: ladda plugin via pluginLoader
      outputChannel.appendLine(`Marketplace: installerad: ${pluginData.id}`);
    },
    (agentId) => {
      outputChannel.appendLine(`Marketplace: avinstallerad: ${agentId}`);
    }
  );
  context.subscriptions.push(marketplace);

  // --- 5f. Ladda plugin-system ---
  const pluginLoader = new PluginLoader(
    (agent) => {
      registry.register(agent);
      agent.setRegistry(registry);
      treeProvider.refresh();
      statusBar.updatePlugins(pluginLoader.listPlugins().length);
    },
    (agentId) => {
      registry.unregister(agentId);
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
        !codeLensProvider['enabled']
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
    vscode.commands.registerCommand('vscode-agent.saveSnippet', async (agentId?: string, prompt?: string) => {
      const editor = vscode.window.activeTextEditor;
      const content = editor?.document.getText(editor.selection.isEmpty ? undefined : editor.selection) ?? '';
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
    },
  });

  outputChannel.appendLine(
    `VS Code Agent aktiverad (fönster-ID: ${sharedState.windowId})`
  );
}

export function deactivate() {
  // Cleanup hanteras av subscriptions
}
