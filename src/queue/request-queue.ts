import * as vscode from 'vscode';
import { AgentResult } from '../agents/base-agent';
import { Middleware, MiddlewareInfo } from '../middleware';

// ─── Typer ───────────────────────────────────────────────────────

/** Prioritetsnivåer för förfrågningar. */
export enum RequestPriority {
  Critical = 0,
  High = 1,
  Normal = 2,
  Low = 3,
}

/** Status för en köad förfrågan. */
export type RequestStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

/** En köad förfrågan i kösystemet. */
export interface QueuedRequest {
  readonly id: string;
  readonly agentId: string;
  readonly prompt: string;
  readonly priority: RequestPriority;
  readonly enqueuedAt: number;
  status: RequestStatus;
  startedAt?: number;
  completedAt?: number;
  result?: AgentResult;
  error?: string;
}

/** Konfiguration för request-kön. */
export interface QueueConfig {
  /** Max samtida exekveringar (default: 3) */
  maxConcurrent: number;
  /** Maximal köstorlek (default: 50) */
  maxQueueSize: number;
  /** Dedupliceringsintervall i ms — liknande förfrågningar inom detta intervall slås samman (default: 2000) */
  deduplicateWindowMs: number;
  /** Standardprioritet för nya förfrågningar */
  defaultPriority: RequestPriority;
}

/** Statistik från kösystemet. */
export interface QueueStats {
  totalEnqueued: number;
  totalProcessed: number;
  totalFailed: number;
  totalCancelled: number;
  totalDeduplicated: number;
  currentQueueSize: number;
  currentProcessing: number;
  avgWaitTimeMs: number;
  avgProcessTimeMs: number;
}

// ─── AgentRequestQueue ──────────────────────────────────────────

/**
 * AgentRequestQueue — prioritetskö som serialiserar och schemalägger
 * agent-förfrågningar för att förhindra samtidighetskonflikter.
 *
 * Stödjer prioritetsnivåer, max-konkurrens, deduplicering,
 * köpositions-synlighet, paus/resume och avbrytning.
 */
export class AgentRequestQueue implements vscode.Disposable {
  private config: QueueConfig;
  private queue: QueuedRequest[] = [];
  private processing = new Map<string, QueuedRequest>();
  private paused = false;
  private counter = 0;

  // Statistik
  private stats_: {
    totalEnqueued: number;
    totalProcessed: number;
    totalFailed: number;
    totalCancelled: number;
    totalDeduplicated: number;
    totalWaitTimeMs: number;
    totalProcessTimeMs: number;
  } = {
    totalEnqueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
    totalCancelled: 0,
    totalDeduplicated: 0,
    totalWaitTimeMs: 0,
    totalProcessTimeMs: 0,
  };

  // Events
  private readonly _onDidEnqueue = new vscode.EventEmitter<QueuedRequest>();
  readonly onDidEnqueue = this._onDidEnqueue.event;

  private readonly _onDidProcess = new vscode.EventEmitter<QueuedRequest>();
  readonly onDidProcess = this._onDidProcess.event;

  private readonly _onDidCancel = new vscode.EventEmitter<QueuedRequest>();
  readonly onDidCancel = this._onDidCancel.event;

  private readonly _onQueueDrain = new vscode.EventEmitter<void>();
  readonly onQueueDrain = this._onQueueDrain.event;

  constructor(config?: Partial<QueueConfig>) {
    this.config = {
      maxConcurrent: config?.maxConcurrent ?? 3,
      maxQueueSize: config?.maxQueueSize ?? 50,
      deduplicateWindowMs: config?.deduplicateWindowMs ?? 2000,
      defaultPriority: config?.defaultPriority ?? RequestPriority.Normal,
    };
  }

  /** Uppdatera kö-konfiguration. */
  updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Aktuell konfiguration (readonly). */
  get currentConfig(): Readonly<QueueConfig> {
    return { ...this.config };
  }

  // ─── Enqueue ──────────────────────────────────────────────────

  /**
   * Lägg till en förfrågan i kön.
   * Returnerar request-id (eller befintligt id om deduplicerat).
   */
  enqueue(
    agentId: string,
    prompt: string,
    priority?: RequestPriority
  ): string {
    const prio = priority ?? this.config.defaultPriority;

    // Deduplicering — finns en liknande förfrågan nyligen?
    const dup = this.findDuplicate(agentId, prompt);
    if (dup) {
      this.stats_.totalDeduplicated++;
      return dup.id;
    }

    // Kontrollera kö-storlek
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new QueueOverflowError(
        `Kön är full (${this.config.maxQueueSize} förfrågningar). Försök igen senare.`
      );
    }

    const request: QueuedRequest = {
      id: `req-${++this.counter}-${Date.now()}`,
      agentId,
      prompt,
      priority: prio,
      enqueuedAt: Date.now(),
      status: 'queued',
    };

    // Insätt sorterat efter prioritet (lägre nummer = högre prioritet)
    const insertIdx = this.queue.findIndex((r) => r.priority > prio);
    if (insertIdx === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(insertIdx, 0, request);
    }

    this.stats_.totalEnqueued++;
    this._onDidEnqueue.fire(request);

    return request.id;
  }

  /** Hämta köposition (0-baserad) för en förfrågan, eller -1 om ej hittad. */
  position(requestId: string): number {
    return this.queue.findIndex((r) => r.id === requestId);
  }

  /** Antal förfrågningar i kön (exklusive de som bearbetas). */
  get size(): number {
    return this.queue.length;
  }

  /** Antal förfrågningar som bearbetas just nu. */
  get activeCount(): number {
    return this.processing.size;
  }

  /** Är kön pausad? */
  get isPaused(): boolean {
    return this.paused;
  }

  // ─── Dequeue / Process ────────────────────────────────────────

  /**
   * Ta nästa förfrågan ur kön (om plats finns för bearbetning).
   * Returnerar undefined om kön är tom, pausad, eller max concurrency nått.
   */
  dequeue(): QueuedRequest | undefined {
    if (this.paused) { return undefined; }
    if (this.processing.size >= this.config.maxConcurrent) { return undefined; }
    if (this.queue.length === 0) { return undefined; }

    const request = this.queue.shift()!;
    request.status = 'processing';
    request.startedAt = Date.now();

    const waitTime = request.startedAt - request.enqueuedAt;
    this.stats_.totalWaitTimeMs += waitTime;

    this.processing.set(request.id, request);
    return request;
  }

  /**
   * Markera en förfrågan som klar.
   */
  complete(requestId: string, result?: AgentResult): void {
    const request = this.processing.get(requestId);
    if (!request) { return; }

    request.status = 'completed';
    request.completedAt = Date.now();
    request.result = result;

    const processTime = request.completedAt - (request.startedAt ?? request.enqueuedAt);
    this.stats_.totalProcessTimeMs += processTime;
    this.stats_.totalProcessed++;

    this.processing.delete(requestId);
    this._onDidProcess.fire(request);

    if (this.queue.length === 0 && this.processing.size === 0) {
      this._onQueueDrain.fire();
    }
  }

  /**
   * Markera en förfrågan som misslyckad.
   */
  fail(requestId: string, error: string): void {
    const request = this.processing.get(requestId);
    if (!request) { return; }

    request.status = 'failed';
    request.completedAt = Date.now();
    request.error = error;

    const processTime = request.completedAt - (request.startedAt ?? request.enqueuedAt);
    this.stats_.totalProcessTimeMs += processTime;
    this.stats_.totalFailed++;

    this.processing.delete(requestId);
    this._onDidProcess.fire(request);

    if (this.queue.length === 0 && this.processing.size === 0) {
      this._onQueueDrain.fire();
    }
  }

  // ─── Cancel ───────────────────────────────────────────────────

  /** Avbryt en köad förfrågan (kan inte avbryta pågående). */
  cancel(requestId: string): boolean {
    const idx = this.queue.findIndex((r) => r.id === requestId);
    if (idx === -1) { return false; }

    const [removed] = this.queue.splice(idx, 1);
    removed.status = 'cancelled';
    removed.completedAt = Date.now();
    this.stats_.totalCancelled++;
    this._onDidCancel.fire(removed);

    return true;
  }

  /** Avbryt alla köade förfrågningar. */
  cancelAll(): number {
    const count = this.queue.length;
    for (const request of this.queue) {
      request.status = 'cancelled';
      request.completedAt = Date.now();
      this._onDidCancel.fire(request);
    }
    this.stats_.totalCancelled += count;
    this.queue = [];
    return count;
  }

  // ─── Pause / Resume ───────────────────────────────────────────

  /** Pausa kön — inga nya förfrågningar bearbetas. */
  pause(): void {
    this.paused = true;
  }

  /** Återuppta kön. */
  resume(): void {
    this.paused = false;
  }

  // ─── Query ────────────────────────────────────────────────────

  /** Hämta en förfrågan via ID (i kö eller bearbetning). */
  get(requestId: string): QueuedRequest | undefined {
    const inQueue = this.queue.find((r) => r.id === requestId);
    if (inQueue) { return inQueue; }
    return this.processing.get(requestId);
  }

  /** Hämta alla köade förfrågningar. */
  pending(): QueuedRequest[] {
    return [...this.queue];
  }

  /** Hämta alla pågående förfrågningar. */
  active(): QueuedRequest[] {
    return [...this.processing.values()];
  }

  /** Alla förfrågningar (köade + pågående). */
  all(): QueuedRequest[] {
    return [...this.queue, ...this.processing.values()];
  }

  // ─── Deduplicering ────────────────────────────────────────────

  private findDuplicate(agentId: string, prompt: string): QueuedRequest | undefined {
    const now = Date.now();
    return this.queue.find(
      (r) =>
        r.agentId === agentId &&
        r.prompt === prompt &&
        r.status === 'queued' &&
        now - r.enqueuedAt < this.config.deduplicateWindowMs
    );
  }

  // ─── Statistik ────────────────────────────────────────────────

  /** Hämta kö-statistik. */
  stats(): QueueStats {
    const totalCompleted = this.stats_.totalProcessed + this.stats_.totalFailed;
    return {
      totalEnqueued: this.stats_.totalEnqueued,
      totalProcessed: this.stats_.totalProcessed,
      totalFailed: this.stats_.totalFailed,
      totalCancelled: this.stats_.totalCancelled,
      totalDeduplicated: this.stats_.totalDeduplicated,
      currentQueueSize: this.queue.length,
      currentProcessing: this.processing.size,
      avgWaitTimeMs: this.stats_.totalEnqueued > 0
        ? this.stats_.totalWaitTimeMs / this.stats_.totalEnqueued
        : 0,
      avgProcessTimeMs: totalCompleted > 0
        ? this.stats_.totalProcessTimeMs / totalCompleted
        : 0,
    };
  }

  /** Nollställ statistik. */
  resetStats(): void {
    this.stats_ = {
      totalEnqueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalCancelled: 0,
      totalDeduplicated: 0,
      totalWaitTimeMs: 0,
      totalProcessTimeMs: 0,
    };
  }

  // ─── Visa kö i QuickPick ──────────────────────────────────────

  /** Visa kö-status i en QuickPick-dialog. */
  async showQueueStatus(): Promise<void> {
    const items: vscode.QuickPickItem[] = [];

    // Pågående
    for (const req of this.processing.values()) {
      const elapsed = Date.now() - (req.startedAt ?? req.enqueuedAt);
      items.push({
        label: `$(loading~spin) ${req.agentId}`,
        description: `⏱ ${elapsed}ms`,
        detail: req.prompt.substring(0, 100),
      });
    }

    // Köade
    for (let i = 0; i < this.queue.length; i++) {
      const req = this.queue[i];
      const priorityLabel = ['🔴 Critical', '🟠 High', '🟢 Normal', '🔵 Low'][req.priority] ?? 'Normal';
      items.push({
        label: `#${i + 1} ${req.agentId}`,
        description: `${priorityLabel}`,
        detail: req.prompt.substring(0, 100),
      });
    }

    if (items.length === 0) {
      vscode.window.showInformationMessage('Kön är tom. Inga väntande förfrågningar.');
      return;
    }

    const header: vscode.QuickPickItem = {
      label: `Kö: ${this.queue.length} väntande, ${this.processing.size} pågående`,
      kind: vscode.QuickPickItemKind.Separator,
    };

    await vscode.window.showQuickPick([header, ...items], {
      title: 'Agent Request Queue',
      placeHolder: 'Aktuella förfrågningar',
    });
  }

  /** Visa köstatistik. */
  async showQueueStats(): Promise<void> {
    const s = this.stats();
    const lines = [
      `📊 Köstatistik`,
      ``,
      `Totalt inkommande: ${s.totalEnqueued}`,
      `Bearbetade: ${s.totalProcessed}`,
      `Misslyckade: ${s.totalFailed}`,
      `Avbrutna: ${s.totalCancelled}`,
      `Deduplicerade: ${s.totalDeduplicated}`,
      ``,
      `Aktuellt i kön: ${s.currentQueueSize}`,
      `Pågående: ${s.currentProcessing}`,
      `Genomsnittlig väntetid: ${Math.round(s.avgWaitTimeMs)}ms`,
      `Genomsnittlig bearbetningstid: ${Math.round(s.avgProcessTimeMs)}ms`,
    ];

    const doc = await vscode.workspace.openTextDocument({
      content: lines.join('\n'),
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }

  // ─── Middleware ───────────────────────────────────────────────

  /**
   * Skapa en middleware som integrerar kö-logik i pipeline.
   * OBS: Denna middleware köar förfrågningar — den bör ha hög prioritet (lågt nummer).
   */
  createMiddleware(): Middleware {
    return {
      name: 'request-queue',
      priority: 5, // Kör tidigt — före timing/usage men efter rate-limit
      before: async (info: MiddlewareInfo) => {
        // Spåra att vi passerade kön
        info.meta['queue.enqueued'] = true;
        info.meta['queue.size'] = this.queue.length;
        info.meta['queue.active'] = this.processing.size;
      },
    };
  }

  // ─── Rensa / Dispose ──────────────────────────────────────────

  /** Rensa hela kön och nollställ statistik. */
  clear(): void {
    this.cancelAll();
    this.resetStats();
  }

  dispose(): void {
    this.cancelAll();
    this._onDidEnqueue.dispose();
    this._onDidProcess.dispose();
    this._onDidCancel.dispose();
    this._onQueueDrain.dispose();
  }
}

// ─── Feltyper ───────────────────────────────────────────────────

/** Kastas när kön är full. */
export class QueueOverflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueOverflowError';
  }
}
