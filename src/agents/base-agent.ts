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
   * Inkluderar automatiskt workspaceContext (git diff, diagnostik) om tillgängligt.
   * Respekterar cancellation token.
   */
  protected async chat(
    ctx: AgentContext,
    systemPrompt: string,
    userMessage?: string
  ): Promise<string> {
    // Injicera arbetsytekontext i systemprompt om tillgängligt
    let enrichedPrompt = systemPrompt;
    if (ctx.workspaceContext) {
      enrichedPrompt += `\n\nArbetsytekontext (automatiskt insamlad):\n${ctx.workspaceContext}`;
    }

    const messages = [
      vscode.LanguageModelChatMessage.User(enrichedPrompt),
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
      const message = this.formatError(error);
      ctx.stream.markdown(`\n\n⚠️ Model error: ${message}`);
      throw error;
    }
  }

  /**
   * Skicka en prompt till LLM utan att strömma — samla hela svaret.
   * Användbart för autonoma agenter som behöver JSON-svar.
   * Respekterar cancellation token.
   */
  protected async chatRaw(
    ctx: AgentContext,
    messages: vscode.LanguageModelChatMessage[]
  ): Promise<string> {
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
      fullResponse += fragment;
    }
    return fullResponse;
  }

  /**
   * Kontrollera om operationen har avbrutits.
   */
  protected isCancelled(ctx: AgentContext): boolean {
    return ctx.token.isCancellationRequested;
  }

  /**
   * Formatera ett fel för visning till användaren.
   * Undviker att visa rå Error-objekt.
   */
  protected formatError(err: unknown): string {
    if (err instanceof vscode.LanguageModelError) {
      return `Språkmodellfel: ${err.message}`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
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
  //  � JSON-parsning av LLM-svar (robust)
  // ─────────────────────────────────────────────────────

  /**
   * Extrahera och parsa JSON från ett LLM-svar.
   * Hanterar:
   *  - JSON i ```json ... ``` kodblock
   *  - Nakna JSON-objekt
   *  - Oavslutade strängar (unescaped newlines/tabs i strängvärden)
   *  - Avslutande kommatecken före } eller ]
   *  - Trunkerad JSON (öppna brackets/braces)
   *
   * Returnerar null om JSON inte kunde extraheras.
   */
  protected extractJson<T = unknown>(response: string): T | null {
    // 1. Försök extrahera från markdown-kodblock
    const codeBlockMatch = response.match(/```json\s*([\s\S]*?)```/);
    // 2. Försök hitta ett naket JSON-objekt
    const bareObjectMatch = response.match(/(\{[\s\S]*\})/);

    const candidates = [
      codeBlockMatch?.[1],
      bareObjectMatch?.[1],
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      // Försök direkt parsning först
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Försök med sanering
      }

      try {
        const sanitized = this.sanitizeJsonString(candidate);
        return JSON.parse(sanitized) as T;
      } catch {
        // Prova nästa kandidat
      }
    }

    return null;
  }

  /**
   * Sanera vanliga JSON-problem i LLM-genererad text.
   */
  private sanitizeJsonString(raw: string): string {
    let json = raw.trim();

    // 1. Ta bort avslutande kommatecken före } eller ]
    json = json.replace(/,(\s*[}\]])/g, '$1');

    // 2. Fixa literal-nyrad/tabb i strängvärden → \n / \t
    const chars = [...json];
    const result: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];

      if (escaped) {
        result.push(ch);
        escaped = false;
        continue;
      }

      if (ch === '\\') {
        result.push(ch);
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        result.push(ch);
        continue;
      }

      if (inString) {
        if (ch === '\n') { result.push('\\n'); continue; }
        if (ch === '\r') { continue; }
        if (ch === '\t') { result.push('\\t'); continue; }
        // Ta bort andra kontrollkaraktärer
        if (ch.charCodeAt(0) < 0x20) { continue; }
      }

      result.push(ch);
    }

    json = result.join('');

    // 3. Stäng oavslutade strängar och brackets
    inString = false;
    escaped = false;
    let braces = 0;
    let brackets = 0;

    for (const ch of json) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) { continue; }
      if (ch === '{') { braces++; }
      if (ch === '}') { braces--; }
      if (ch === '[') { brackets++; }
      if (ch === ']') { brackets--; }
    }

    if (inString) { json += '"'; }
    while (brackets > 0) { json += ']'; brackets--; }
    while (braces > 0) { json += '}'; braces--; }

    return json;
  }

  // ─────────────────────────────────────────────────────
  //  �🔗 Delegation helpers (kräver AgentRegistry injection)
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
