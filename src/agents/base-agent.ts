import * as vscode from 'vscode';
import { streamResponse } from '../utils/streaming';
import { extractTurnText } from '../utils/history';

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
      const fullMessage = extractTurnText(turn);
      if (fullMessage) {
        messages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
      }
    }

    // Lägg till användarens meddelande
    messages.push(
      vscode.LanguageModelChatMessage.User(userMessage ?? ctx.request.prompt)
    );

    try {
      const model = await this.resolveModel(ctx);
      const modelOptions = this.getModelOptions();
      const chatResponse = await model.sendRequest(
        messages,
        modelOptions,
        ctx.token
      );

      const fullResponse = await streamResponse(chatResponse, ctx.stream, ctx.token);
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
    const model = await this.resolveModel(ctx);
    const modelOptions = this.getModelOptions();
    const chatResponse = await model.sendRequest(
      messages,
      modelOptions,
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
  //  🧠 Memory helpers (kräver AgentMemory injection)
  // ─────────────────────────────────────────────────────

  private _memory?: import('../memory').AgentMemory;

  /** Injiceras av extension.ts efter registrering */
  setMemory(mem: import('../memory').AgentMemory): void {
    this._memory = mem;
  }

  /** Åtkomst till agentminne, undefined om ej injicerat */
  protected get memory(): import('../memory').AgentMemory | undefined {
    return this._memory;
  }

  // ─────────────────────────────────────────────────────
  //  🤖 ModelSelector (kräver injection)
  // ─────────────────────────────────────────────────────

  private _modelSelector?: import('../models').ModelSelector;

  /** Injiceras av extension.ts efter registrering */
  setModelSelector(selector: import('../models').ModelSelector): void {
    this._modelSelector = selector;
  }

  /** Åtkomst till modell-väljare, undefined om ej injicerat */
  protected get modelSelector(): import('../models').ModelSelector | undefined {
    return this._modelSelector;
  }

  /**
   * Hämta rätt modell för denna agent. Använder ModelSelector om tillgängligt,
   * annars fallback till request-modellen.
   */
  protected async resolveModel(
    ctx: AgentContext
  ): Promise<vscode.LanguageModelChat> {
    if (this._modelSelector) {
      return this._modelSelector.selectModel(this.id, ctx.request.model);
    }
    return ctx.request.model;
  }

  /**
   * Hämta modell-options (temperatur, max tokens) för denna agent.
   */
  protected getModelOptions(): Record<string, unknown> {
    if (this._modelSelector) {
      return this._modelSelector.getModelOptions(this.id) as unknown as Record<string, unknown>;
    }
    return {};
  }

  // ─────────────────────────────────────────────────────
  //  🔧 ToolRegistry (kräver injection)
  // ─────────────────────────────────────────────────────

  private _toolRegistry?: import('../tools').ToolRegistry;

  /** Injiceras av extension.ts efter registrering */
  setTools(toolReg: import('../tools').ToolRegistry): void {
    this._toolRegistry = toolReg;
  }

  /** Åtkomst till verktygsregistret, undefined om ej injicerat */
  protected get toolRegistry(): import('../tools').ToolRegistry | undefined {
    return this._toolRegistry;
  }

  /**
   * Kör ett verktyg efter ID (t.ex. 'file', 'search').
   * Kräver att setTools() anropats.
   */
  protected async executeTool(
    toolId: string,
    params: Record<string, unknown>,
    token: vscode.CancellationToken
  ): Promise<import('../tools').ToolResult> {
    if (!this._toolRegistry) {
      return { success: false, error: 'ToolRegistry ej injicerat. Anropa setTools() först.' };
    }
    return this._toolRegistry.execute(toolId, params, token);
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
