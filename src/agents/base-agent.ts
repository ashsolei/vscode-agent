import * as vscode from 'vscode';

/**
 * Resultat från en agent-exekvering.
 */
export interface AgentResult {
  /** Metadata som agenten vill spara */
  metadata?: Record<string, unknown>;
  /** Föreslagna uppföljningsmeddelanden */
  followUps?: vscode.ChatFollowup[];
}

/**
 * Kontext som skickas till en agent vid varje anrop.
 */
export interface AgentContext {
  request: vscode.ChatRequest;
  chatContext: vscode.ChatContext;
  stream: vscode.ChatResponseStream;
  token: vscode.CancellationToken;
  /** Automatiskt injicerad arbetsytekontexttext (git diff, diagnostik, etc.) */
  workspaceContext?: string;
}

/**
 * Abstrakt basklass för alla agenter.
 * Varje specialiserad agent ärver denna och implementerar `handle()`.
 */
export abstract class BaseAgent {
  /** Whether this agent performs autonomous file/terminal operations */
  public readonly isAutonomous: boolean;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    options?: { isAutonomous?: boolean }
  ) {
    this.isAutonomous = options?.isAutonomous ?? false;
  }

  /**
   * Huvudmetoden som hanterar ett chat-meddelande.
   * Implementeras av varje specialiserad agent.
   */
  abstract handle(ctx: AgentContext): Promise<AgentResult>;

  /**
   * Skicka en prompt till språkmodellen och strömma svaret.
   */
  protected async chat(
    ctx: AgentContext,
    systemPrompt: string,
    userMessage?: string
  ): Promise<string> {
    const messages = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
    ];

    // Bygg historik från tidigare konversationsvarv
    const previousTurns = ctx.chatContext.history.filter(
      (h) => h instanceof vscode.ChatResponseTurn
    );

    for (const turn of previousTurns) {
      let fullMessage = '';
      for (const part of turn.response) {
        const mdPart = part as vscode.ChatResponseMarkdownPart;
        if (mdPart?.value?.value) {
          fullMessage += mdPart.value.value;
        }
      }
      if (fullMessage) {
        messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
      }
    }

    // Lägg till användarens meddelande
    messages.push(
      vscode.LanguageModelChatMessage.User(userMessage ?? ctx.request.prompt)
    );

    try {
      const chatResponse = await ctx.request.model.sendRequest(
        messages,
        {},
        ctx.token
      );

      let fullResponse = '';
      for await (const fragment of chatResponse.text) {
        if (ctx.token.isCancellationRequested) {
          break;
        }
        ctx.stream.markdown(fragment);
        fullResponse += fragment;
      }

      return fullResponse;
    } catch (error) {
      if (ctx.token.isCancellationRequested) {
        ctx.stream.markdown('\n\n*— Operation cancelled.*');
        return '';
      }
      const message = error instanceof Error ? error.message : String(error);
      ctx.stream.markdown(`\n\n⚠️ Model error: ${message}`);
      throw error;
    }
  }

  /**
   * Visa en progress-indikator i chatten.
   */
  protected progress(ctx: AgentContext, message: string): void {
    ctx.stream.progress(message);
  }

  /**
   * Lägg till en knapp i chatsvaret.
   */
  protected button(ctx: AgentContext, title: string, command: string, args?: unknown[]): void {
    ctx.stream.button({
      command,
      title,
      arguments: args,
    });
  }

  /**
   * Lägg till en fil-referens i chatsvaret.
   */
  protected reference(ctx: AgentContext, uri: vscode.Uri): void {
    ctx.stream.reference(uri);
  }

  // ─────────────────────────────────────────────────────
  //  🔗 Delegation helpers (kräver AgentRegistry injection)
  // ─────────────────────────────────────────────────────

  private _registry?: import('./index').AgentRegistry;

  /** Injiceras av extension.ts efter registrering */
  setRegistry(registry: import('./index').AgentRegistry): void {
    this._registry = registry;
  }

  /**
   * Delegera till en annan agent (single hop).
   * Kräver att setRegistry() anropats.
   */
  protected async delegateTo(
    agentId: string,
    ctx: AgentContext,
    prompt?: string
  ): Promise<string> {
    if (!this._registry) {
      throw new Error('AgentRegistry ej injicerad. Anropa setRegistry() först.');
    }
    const { text } = await this._registry.delegate(agentId, ctx, prompt);
    return text;
  }
}
