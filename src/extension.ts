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

/**
 * Extension entry point.
 * Sätter upp agentregistret, verktyg, delat tillstånd och VS Code Chat Participant.
 */
export function activate(context: vscode.ExtensionContext) {
  // --- 1. Initiera delat tillstånd (synkroniseras mellan fönster) ---
  const sharedState = new SharedState(
    context.globalState,
    context.globalStorageUri
  );

  // --- 2. Skapa verktygsregistret ---
  const tools = ToolRegistry.createDefault();

  // --- 2b. Skapa persistent minne ---
  const memory = new AgentMemory(context.globalState);
  // Automatisk rensning av gamla minnen
  memory.prune();

  // --- 2c. Skapa middleware-pipeline ---
  const outputChannel = vscode.window.createOutputChannel('VS Code Agent');
  context.subscriptions.push(outputChannel);

  const middleware = new MiddlewarePipeline();
  middleware.use(createRateLimitMiddleware(30));
  middleware.use(createTimingMiddleware(outputChannel));
  middleware.use(createUsageMiddleware(context.globalState));

  // --- 2d. Skapa dashboard ---
  const dashboard = new AgentDashboard(context.extensionUri);

  // --- 2e. Skapa guard rails ---
  const _guardrails = new GuardRails();

  // --- 2f. Skapa config manager ---
  const configManager = new ConfigManager();
  context.subscriptions.push({ dispose: () => configManager.dispose() });

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

  // Standardagenten är code
  registry.setDefault('code');

  // Injicera registret i alla agenter (för delegation/chaining)
  for (const agent of registry.list()) {
    agent.setRegistry(registry);
  }

  // --- 3b. Skapa workflow-engine ---
  const workflowEngine = new WorkflowEngine(registry);

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
        '**👾 Autonoma:** `/component` `/i18n` `/plan` `/a11y` `/docgen` `/metrics` `/cli` `/fullstack`');
      return;
    }

    try {
      // Dashboard: logga start
      const dashId = dashboard.logStart(agent.id, agent.name, request.prompt);

      // Kör genom middleware-pipeline (timing, rate-limit, usage)
      const result = await middleware.execute(agent, ctx);

      // Dashboard: logga slut
      dashboard.logEnd(dashId, true);

      // Returnera uppföljningsförslag om agenten gav sådana
      if (result.followUps && result.followUps.length > 0) {
        return {
          metadata: { command: request.command ?? 'default' },
          followUp: result.followUps,
        } as vscode.ChatResult;
      }

      return { metadata: { command: request.command ?? 'default' } };
    } catch (error) {
      // Dashboard: logga fel
      dashboard.logEnd('', false, String(error));

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
      // Returnera followUps som sparades i resultatet
      return (result as any).followUp ?? [];
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

  // --- 5c. Registrera CodeLens ---
  const codeLensProvider = new AgentCodeLensProvider();
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
      const result = await _guardrails.undo();
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
    },
  });

  outputChannel.appendLine(
    `VS Code Agent aktiverad (fönster-ID: ${sharedState.windowId})`
  );
}

export function deactivate() {
  // Cleanup hanteras av subscriptions
}
