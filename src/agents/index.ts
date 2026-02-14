import * as vscode from 'vscode';
import { BaseAgent, AgentContext } from './base-agent';
import type { AgentResult } from './base-agent';

/**
 * Resultat från en agentkedja.
 */
export interface ChainStep {
  agentId: string;
  prompt: string;
  /** Skriv över prompten med output från föregående steg */
  pipeOutput?: boolean;
}

/**
 * AgentRegistry — ett centralt register för alla agenter.
 * Tillåter registrering, dynamisk routing, kedjning och smart auto-routing.
 */
export class AgentRegistry {
  private agents = new Map<string, BaseAgent>();
  private defaultAgent: BaseAgent | undefined;
  /** Maximalt antal steg i en agentkedja */
  static readonly MAX_CHAIN_DEPTH = 20;

  /**
   * Registrera en agent. Det första registrerade agenten blir standard.
   */
  register(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);
    if (!this.defaultAgent) {
      this.defaultAgent = agent;
    }
  }

  /**
   * Sätt en specifik agent som standardagent.
   */
  setDefault(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.defaultAgent = agent;
    }
  }

  /**
   * Hitta rätt agent baserat på slash-kommandot i requesten.
   * Om inget kommando anges, används standardagenten.
   */
  resolve(ctx: AgentContext): BaseAgent | undefined {
    if (ctx.request.command) {
      return this.agents.get(ctx.request.command) ?? this.defaultAgent;
    }
    return this.defaultAgent;
  }

  /**
   * Hämta en specifik agent.
   */
  get(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Lista alla registrerade agenter.
   */
  list(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  // ─────────────────────────────────────────────────────
  //  🔗 AGENTKEDJA — agents delegating to other agents
  // ─────────────────────────────────────────────────────

  /**
   * Delegera ett meddelande till en annan agent ("single hop").
   * Returnerar agentens textsvar.
   */
  async delegate(
    targetId: string,
    ctx: AgentContext,
    overridePrompt?: string
  ): Promise<{ result: AgentResult; text: string }> {
    const agent = this.agents.get(targetId);
    if (!agent) {
      throw new Error(`Agent "${targetId}" finns inte i registret.`);
    }

    // Skapa en proxy-context som fångar markdown-output
    let captured = '';
    const proxyStream = new Proxy(ctx.stream, {
      get(target, prop, receiver) {
        if (prop === 'markdown') {
          return (value: string | vscode.MarkdownString) => {
            const text = typeof value === 'string' ? value : value.value;
            captured += text;
            // Fortfarande strömma till användaren
            target.markdown(value);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    const proxyCtx: AgentContext = {
      ...ctx,
      stream: proxyStream,
      request: overridePrompt
        ? new Proxy(ctx.request, {
            get(target, prop) {
              if (prop === 'prompt') { return overridePrompt; }
              return Reflect.get(target, prop);
            },
          })
        : ctx.request,
    };

    ctx.stream.progress(`🔗 Delegerar till ${agent.name}...`);
    const result = await agent.handle(proxyCtx);
    return { result, text: captured };
  }

  /**
   * Kör en kedja av agenter i sekvens.
   * Varje steg kan använda outputen från föregående steg som sin prompt.
   */
  async chain(
    steps: ChainStep[],
    ctx: AgentContext
  ): Promise<Array<{ agentId: string; result: AgentResult; text: string }>> {
    if (steps.length > AgentRegistry.MAX_CHAIN_DEPTH) {
      throw new Error(
        `Agentkedjan överskrider maxdjupet (${AgentRegistry.MAX_CHAIN_DEPTH} steg). Fick ${steps.length} steg.`
      );
    }

    const results: Array<{ agentId: string; result: AgentResult; text: string }> = [];
    let previousOutput = '';

    ctx.stream.markdown(`\n### 🔗 Agentkedja startar (${steps.length} steg)\n`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const prompt = step.pipeOutput && previousOutput
        ? `${step.prompt}\n\n---\nOutput från föregående steg:\n${previousOutput}`
        : step.prompt;

      ctx.stream.markdown(`\n**Steg ${i + 1}/${steps.length}:** \`${step.agentId}\`\n\n`);

      const { result, text } = await this.delegate(step.agentId, ctx, prompt);
      results.push({ agentId: step.agentId, result, text });
      previousOutput = text;
    }

    ctx.stream.markdown(`\n### ✅ Agentkedja klar (${results.length} steg)\n`);
    return results;
  }

  // ─────────────────────────────────────────────────────
  //  🧠 SMART AUTO-ROUTER — LLM-based agent selection
  // ─────────────────────────────────────────────────────

  /**
   * Använd LLM för att automatiskt välja rätt agent baserat på
   * användarens meddelande (ingen slash-command behövs).
   */
  async smartRoute(ctx: AgentContext): Promise<BaseAgent | undefined> {
    const agentDescriptions = this.list()
      .map((a) => `- ${a.id}: ${a.description}`)
      .join('\n');

    const routerPrompt = `Du är en router. Analysera användarens meddelande och välj den bästa agenten.

Tillgängliga agenter:
${agentDescriptions}

Svara med EXAKT ett agent-id (t.ex. "code", "refactor", "scaffold").
Om ingen agent matchar, svara "code".
Svara ENBART med agent-id, inget annat.`;

    try {
      const messages = [
        vscode.LanguageModelChatMessage.User(routerPrompt),
        vscode.LanguageModelChatMessage.User(ctx.request.prompt),
      ];

      const response = await ctx.request.model.sendRequest(messages, {}, ctx.token);
      let agentId = '';
      for await (const fragment of response.text) {
        agentId += fragment;
      }

      agentId = agentId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

      const matched = this.agents.get(agentId);
      if (matched) {
        ctx.stream.progress(`🧠 Auto-valde agent: ${matched.name}`);
        return matched;
      }
    } catch {
      // Om LLM-routing misslyckas, fall tillbaka till standardagenten
    }

    return this.defaultAgent;
  }

  // ─────────────────────────────────────────────────────
  //  ⚡ PARALLELL EXEKVERING — run agents simultaneously
  // ─────────────────────────────────────────────────────

  /**
   * Kör flera agenter parallellt med samma (eller olika) prompts.
   * Samlar in resultat från alla agenter.
   * OBS: stream output interleaves — bäst för agenter som skriver till separata sektioner.
   */
  async parallel(
    tasks: Array<{ agentId: string; prompt?: string }>,
    ctx: AgentContext
  ): Promise<Array<{ agentId: string; result?: AgentResult; text: string; error?: string }>> {
    ctx.stream.markdown(`\n### ⚡ Parallell exekvering (${tasks.length} agenter)\n`);

    const promises = tasks.map(async (task) => {
      const agent = this.agents.get(task.agentId);
      if (!agent) {
        return { agentId: task.agentId, text: '', error: `Agent "${task.agentId}" finns inte` };
      }

      // Skapa en proxy som fångar text
      let captured = '';
      const proxyStream = new Proxy(ctx.stream, {
        get(target, prop) {
          if (prop === 'markdown') {
            return (value: string | vscode.MarkdownString) => {
              const text = typeof value === 'string' ? value : value.value;
              captured += text;
              target.markdown(value);
            };
          }
          return Reflect.get(target, prop);
        },
      });

      const proxyCtx: AgentContext = {
        ...ctx,
        stream: proxyStream,
        request: task.prompt
          ? new Proxy(ctx.request, {
              get(target, prop) {
                if (prop === 'prompt') { return task.prompt; }
                return Reflect.get(target, prop);
              },
            })
          : ctx.request,
      };

      try {
        const result = await agent.handle(proxyCtx);
        return { agentId: task.agentId, result, text: captured };
      } catch (err) {
        return { agentId: task.agentId, text: captured, error: String(err) };
      }
    });

    const results = await Promise.allSettled(promises);

    const output = results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { agentId: 'unknown', text: '', error: String(r.reason) }
    );

    const ok = output.filter((o) => !o.error).length;
    const fail = output.filter((o) => o.error).length;
    ctx.stream.markdown(`\n### ✅ Parallell klar — ${ok} ok, ${fail} fel\n`);

    return output;
  }
}

export { BaseAgent, AgentContext } from './base-agent';
export type { AgentResult } from './base-agent';
