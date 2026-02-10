import * as vscode from 'vscode';
import { AgentRegistry } from '../agents';
import type { AgentContext, AgentResult } from '../agents/base-agent';

/**
 * Röstresultat från en enskild agent.
 */
export interface AgentVote {
  agentId: string;
  agentName: string;
  response: string;
  confidence: number;  // 0.0 – 1.0
  duration: number;    // ms
}

/**
 * Sammanställt resultat från en omröstning.
 */
export interface CollaborationResult {
  question: string;
  votes: AgentVote[];
  winner: AgentVote | null;
  consensus: string;
  agreementLevel: number; // 0.0 – 1.0
  totalDuration: number;
}

/**
 * AgentCollaboration — låter flera agenter analysera samma problem
 * och rösta/debattera för att nå bästa lösningen.
 *
 * Modes:
 * - **vote**: Alla agenter svarar, LLM utser vinnaren
 * - **debate**: Agenter ser varandras svar och kan argumentera
 * - **consensus**: LLM syntetiserar alla svar till ett enhetligt svar
 * - **review-chain**: Varje agent granskar föregående agents svar
 */
export class AgentCollaboration {
  constructor(private registry: AgentRegistry) {}

  // ─── VOTE MODE ──────────────────────────────

  /**
   * Alla angivna agenter svarar på samma fråga parallellt.
   * En LLM-jurydomare utser det bästa svaret.
   */
  async vote(
    agentIds: string[],
    ctx: AgentContext
  ): Promise<CollaborationResult> {
    const start = Date.now();
    ctx.stream.markdown(
      `## 🗳️ Agent-omröstning (${agentIds.length} agenter)\n\n`
    );

    // Kör alla agenter parallellt
    const votes = await this.collectVotes(agentIds, ctx);

    if (votes.length === 0) {
      ctx.stream.markdown('❌ Inga agenter kunde svara.\n');
      return {
        question: ctx.request.prompt,
        votes: [],
        winner: null,
        consensus: '',
        agreementLevel: 0,
        totalDuration: Date.now() - start,
      };
    }

    // LLM-jurydomare väljer bäst svar
    ctx.stream.markdown('\n### 🏛️ Jurybedömning\n\n');
    const judgment = await this.judge(votes, ctx);

    ctx.stream.markdown(judgment.consensus + '\n');

    return {
      question: ctx.request.prompt,
      votes,
      winner: judgment.winner,
      consensus: judgment.consensus,
      agreementLevel: judgment.agreementLevel,
      totalDuration: Date.now() - start,
    };
  }

  // ─── DEBATE MODE ────────────────────────────

  /**
   * Agenter debatterar i omgångar. Varje agent ser andras svar
   * och kan uppdatera sitt eget. Max `rounds` omgångar.
   */
  async debate(
    agentIds: string[],
    ctx: AgentContext,
    rounds: number = 2
  ): Promise<CollaborationResult> {
    const start = Date.now();
    ctx.stream.markdown(
      `## 💬 Agent-debatt (${agentIds.length} agenter, ${rounds} omgångar)\n\n`
    );

    let currentVotes = await this.collectVotes(agentIds, ctx);

    for (let round = 2; round <= rounds; round++) {
      ctx.stream.markdown(`\n### Omgång ${round}\n\n`);

      // Varje agent ser de andras svar
      const debatePrompt = this.buildDebateContext(currentVotes);

      const updatedVotes: AgentVote[] = [];
      for (const agentId of agentIds) {
        const agent = this.registry.get(agentId);
        if (!agent) { continue; }

        const roundStart = Date.now();
        let captured = '';

        const proxyStream = this.createCaptureProxy(ctx.stream, (text) => {
          captured += text;
        });

        const proxyCtx: AgentContext = {
          ...ctx,
          stream: proxyStream,
          request: new Proxy(ctx.request, {
            get(target, prop) {
              if (prop === 'prompt') {
                return `${debatePrompt}\n\nBaserat på diskussionen ovan, ge ditt uppdaterade svar på: ${ctx.request.prompt}`;
              }
              return Reflect.get(target, prop);
            },
          }),
        };

        try {
          await agent.handle(proxyCtx);
          updatedVotes.push({
            agentId,
            agentName: agent.name,
            response: captured,
            confidence: this.estimateConfidence(captured),
            duration: Date.now() - roundStart,
          });
        } catch {
          // Agenten misslyckades denna omgång
        }
      }

      if (updatedVotes.length > 0) {
        currentVotes = updatedVotes;
      }
    }

    // Slutgiltig bedömning
    ctx.stream.markdown('\n### 🏛️ Slutgiltig bedömning\n\n');
    const judgment = await this.judge(currentVotes, ctx);
    ctx.stream.markdown(judgment.consensus + '\n');

    return {
      question: ctx.request.prompt,
      votes: currentVotes,
      winner: judgment.winner,
      consensus: judgment.consensus,
      agreementLevel: judgment.agreementLevel,
      totalDuration: Date.now() - start,
    };
  }

  // ─── CONSENSUS MODE ─────────────────────────

  /**
   * Alla agenter svarar, sedan syntetiserar LLM ett gemensamt svar
   * som kombinerar det bästa från alla.
   */
  async consensus(
    agentIds: string[],
    ctx: AgentContext
  ): Promise<CollaborationResult> {
    const start = Date.now();
    ctx.stream.markdown(
      `## 🤝 Konsensus-syntest (${agentIds.length} agenter)\n\n`
    );

    const votes = await this.collectVotes(agentIds, ctx);

    if (votes.length < 2) {
      ctx.stream.markdown('⚠️ Behöver minst 2 agenters svar för konsensus.\n');
      return {
        question: ctx.request.prompt,
        votes,
        winner: votes[0] ?? null,
        consensus: votes[0]?.response ?? '',
        agreementLevel: 1,
        totalDuration: Date.now() - start,
      };
    }

    // Syntetisera
    ctx.stream.markdown('\n### 🧬 Syntetiserat svar\n\n');

    const synthPrompt = `Du är en expert på att syntetisera svar. Kombinera det bästa från dessa ${votes.length} svar till ETT optimalt svar.

Fråga: ${ctx.request.prompt}

${votes.map((v, i) => `--- Svar ${i + 1} (${v.agentName}) ---\n${v.response}`).join('\n\n')}

Skapa ett syntetiserat svar som:
1. Tar det bästa från varje svar
2. Eliminerar felaktigheter och dubbletter
3. Är välstrukturerat och komplett
4. Nämner vilka perspektiv som var mest värdefulla`;

    const messages = [
      vscode.LanguageModelChatMessage.User(synthPrompt),
    ];

    let synthesized = '';
    try {
      const response = await ctx.request.model.sendRequest(messages, {}, ctx.token);
      for await (const fragment of response.text) {
        ctx.stream.markdown(fragment);
        synthesized += fragment;
      }
    } catch {
      synthesized = 'Kunde inte syntetisera svar.';
      ctx.stream.markdown(synthesized);
    }

    return {
      question: ctx.request.prompt,
      votes,
      winner: null,
      consensus: synthesized,
      agreementLevel: this.calculateAgreement(votes),
      totalDuration: Date.now() - start,
    };
  }

  // ─── REVIEW CHAIN ──────────────────────────

  /**
   * Varje agent granskar och förbättrar föregående agents svar.
   * Sista agentens svar är det slutgiltiga.
   */
  async reviewChain(
    agentIds: string[],
    ctx: AgentContext
  ): Promise<CollaborationResult> {
    const start = Date.now();
    ctx.stream.markdown(
      `## 🔗 Granskninsgskedja (${agentIds.length} agenter)\n\n`
    );

    const votes: AgentVote[] = [];
    let previousResponse = '';

    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agent = this.registry.get(agentId);
      if (!agent) { continue; }

      const isFirst = i === 0;
      const roundStart = Date.now();
      let captured = '';

      ctx.stream.markdown(`\n### Steg ${i + 1}: ${agent.name}\n\n`);

      const prompt = isFirst
        ? ctx.request.prompt
        : `Granska och förbättra följande svar på frågan: "${ctx.request.prompt}"

Föregående svar:
${previousResponse}

Ditt uppdrag:
1. Identifiera brister eller felaktigheter
2. Lägg till saknade perspektiv
3. Förbättra kvaliteten och strukturen
4. Ge ditt förbättrade svar`;

      const proxyStream = this.createCaptureProxy(ctx.stream, (text) => {
        captured += text;
      });

      const proxyCtx: AgentContext = {
        ...ctx,
        stream: proxyStream,
        request: new Proxy(ctx.request, {
          get(target, prop) {
            if (prop === 'prompt') { return prompt; }
            return Reflect.get(target, prop);
          },
        }),
      };

      try {
        await agent.handle(proxyCtx);
        votes.push({
          agentId,
          agentName: agent.name,
          response: captured,
          confidence: this.estimateConfidence(captured),
          duration: Date.now() - roundStart,
        });
        previousResponse = captured;
      } catch {
        ctx.stream.markdown(`⚠️ ${agent.name} misslyckades.\n`);
      }
    }

    const lastVote = votes[votes.length - 1] ?? null;

    return {
      question: ctx.request.prompt,
      votes,
      winner: lastVote,
      consensus: lastVote?.response ?? '',
      agreementLevel: this.calculateAgreement(votes),
      totalDuration: Date.now() - start,
    };
  }

  // ─── Privata helpers ────────────────────────

  /**
   * Samla in svar från alla agenter parallellt.
   */
  private async collectVotes(
    agentIds: string[],
    ctx: AgentContext
  ): Promise<AgentVote[]> {
    const promises = agentIds.map(async (agentId) => {
      const agent = this.registry.get(agentId);
      if (!agent) { return null; }

      const start = Date.now();
      let captured = '';

      const proxyStream = this.createCaptureProxy(ctx.stream, (text) => {
        captured += text;
      });

      const proxyCtx: AgentContext = {
        ...ctx,
        stream: proxyStream,
      };

      ctx.stream.markdown(`**${agent.name}** svarar...\n`);

      try {
        await agent.handle(proxyCtx);
        return {
          agentId,
          agentName: agent.name,
          response: captured,
          confidence: this.estimateConfidence(captured),
          duration: Date.now() - start,
        };
      } catch {
        return null;
      }
    });

    const results = await Promise.allSettled(promises);
    return results
      .filter((r): r is PromiseFulfilledResult<AgentVote | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((v): v is AgentVote => v !== null);
  }

  /**
   * LLM-jurydomare bedömer svaren.
   */
  private async judge(
    votes: AgentVote[],
    ctx: AgentContext
  ): Promise<{ winner: AgentVote | null; consensus: string; agreementLevel: number }> {
    const judgePrompt = `Du är en opartisk domare. Bedöm dessa ${votes.length} svar och välj det bästa.

Fråga: ${ctx.request.prompt}

${votes.map((v, i) => `--- Svar ${i + 1} (${v.agentName}, ${v.duration}ms) ---\n${v.response.substring(0, 2000)}`).join('\n\n')}

Svara i detta format:
VINNARE: <agent-namn>
MOTIVERING: <korta motivering>
ÖVERENSSTÄMMELSE: <0.0-1.0, hur mycket agenterna var överens>`;

    try {
      const messages = [
        vscode.LanguageModelChatMessage.User(judgePrompt),
      ];
      const response = await ctx.request.model.sendRequest(messages, {}, ctx.token);
      let judgment = '';
      for await (const fragment of response.text) {
        judgment += fragment;
      }

      // Parsa vinnare
      const winnerMatch = judgment.match(/VINNARE:\s*(.+)/i);
      const agreementMatch = judgment.match(/ÖVERENSSTÄMMELSE:\s*([\d.]+)/i);

      const winnerName = winnerMatch?.[1]?.trim() ?? '';
      const winner = votes.find((v) => v.agentName.toLowerCase() === winnerName.toLowerCase()) ?? votes[0];
      const agreementLevel = agreementMatch ? parseFloat(agreementMatch[1]) : 0.5;

      return { winner, consensus: judgment, agreementLevel };
    } catch {
      return { winner: votes[0] ?? null, consensus: 'Kunde inte bedöma.', agreementLevel: 0 };
    }
  }

  private buildDebateContext(votes: AgentVote[]): string {
    return votes
      .map((v) => `**${v.agentName}** sa:\n${v.response.substring(0, 1500)}`)
      .join('\n\n---\n\n');
  }

  private estimateConfidence(response: string): number {
    // Heuristik: längre svar med kodblock = högre confidence
    let score = 0.5;
    if (response.length > 500) { score += 0.1; }
    if (response.length > 1500) { score += 0.1; }
    if (response.includes('```')) { score += 0.1; }
    if (response.includes('##') || response.includes('**')) { score += 0.05; }
    if (/\b(kanske|osäker|vet inte)\b/i.test(response)) { score -= 0.15; }
    return Math.min(1, Math.max(0, score));
  }

  private calculateAgreement(votes: AgentVote[]): number {
    if (votes.length < 2) { return 1; }
    // Enkel heuristik baserad på gemensamma nyckelord
    const wordSets = votes.map((v) => new Set(
      v.response.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
    ));

    let totalOverlap = 0;
    let comparisons = 0;

    for (let i = 0; i < wordSets.length; i++) {
      for (let j = i + 1; j < wordSets.length; j++) {
        const intersection = new Set([...wordSets[i]].filter((w) => wordSets[j].has(w)));
        const union = new Set([...wordSets[i], ...wordSets[j]]);
        totalOverlap += union.size > 0 ? intersection.size / union.size : 0;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalOverlap / comparisons : 0;
  }

  private createCaptureProxy(
    stream: vscode.ChatResponseStream,
    onCapture: (text: string) => void
  ): vscode.ChatResponseStream {
    return new Proxy(stream, {
      get(target, prop) {
        if (prop === 'markdown') {
          return (value: string | vscode.MarkdownString) => {
            const text = typeof value === 'string' ? value : value.value;
            onCapture(text);
            target.markdown(value);
          };
        }
        return Reflect.get(target, prop);
      },
    });
  }
}
