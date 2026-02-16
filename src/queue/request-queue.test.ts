import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AgentRequestQueue,
  RequestPriority,
  QueueOverflowError,
} from './request-queue';

// ─── Helpers ────────────────────────────────────────────────────

function createQueue(config?: Partial<import('./request-queue').QueueConfig>) {
  return new AgentRequestQueue(config);
}

// ─── Tests ──────────────────────────────────────────────────────

describe('AgentRequestQueue', () => {
  let queue: AgentRequestQueue;

  beforeEach(() => {
    queue = createQueue();
  });

  // ─── Constructor & Config ─────────────────────────────────────

  describe('constructor & config', () => {
    it('skapar med standardkonfiguration', () => {
      const cfg = queue.currentConfig;
      expect(cfg.maxConcurrent).toBe(3);
      expect(cfg.maxQueueSize).toBe(50);
      expect(cfg.deduplicateWindowMs).toBe(2000);
      expect(cfg.defaultPriority).toBe(RequestPriority.Normal);
    });

    it('accepterar anpassad konfiguration', () => {
      const q = createQueue({ maxConcurrent: 5, maxQueueSize: 10 });
      const cfg = q.currentConfig;
      expect(cfg.maxConcurrent).toBe(5);
      expect(cfg.maxQueueSize).toBe(10);
    });

    it('uppdaterar konfiguration partiellt', () => {
      queue.updateConfig({ maxConcurrent: 10 });
      expect(queue.currentConfig.maxConcurrent).toBe(10);
      expect(queue.currentConfig.maxQueueSize).toBe(50); // Oförändrad
    });
  });

  // ─── Enqueue ──────────────────────────────────────────────────

  describe('enqueue', () => {
    it('lägger till en förfrågan och returnerar id', () => {
      const id = queue.enqueue('code', 'Fixa bugg');
      expect(id).toMatch(/^req-/);
      expect(queue.size).toBe(1);
    });

    it('enqueue med explicit prioritet', () => {
      queue.enqueue('code', 'Låg prio', RequestPriority.Low);
      queue.enqueue('code', 'Hög prio', RequestPriority.High);
      queue.enqueue('code', 'Critical', RequestPriority.Critical);

      const pending = queue.pending();
      expect(pending[0].priority).toBe(RequestPriority.Critical);
      expect(pending[1].priority).toBe(RequestPriority.High);
      expect(pending[2].priority).toBe(RequestPriority.Low);
    });

    it('sorterar efter prioritet vid insättning', () => {
      queue.enqueue('a', 'Normal 1', RequestPriority.Normal);
      queue.enqueue('b', 'Normal 2', RequestPriority.Normal);
      queue.enqueue('c', 'Critical', RequestPriority.Critical);

      const pending = queue.pending();
      expect(pending[0].agentId).toBe('c');
      expect(pending[0].priority).toBe(RequestPriority.Critical);
    });

    it('emittar onDidEnqueue-event', () => {
      const handler = vi.fn();
      queue.onDidEnqueue(handler);
      queue.enqueue('code', 'Test prompt');
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].agentId).toBe('code');
    });

    it('kastar QueueOverflowError vid full kö', () => {
      const q = createQueue({ maxQueueSize: 2 });
      q.enqueue('a', 'Prompt 1');
      q.enqueue('b', 'Prompt 2');
      expect(() => q.enqueue('c', 'Prompt 3')).toThrow(QueueOverflowError);
    });

    it('räknar statistik korrekt', () => {
      queue.enqueue('a', 'P1');
      queue.enqueue('b', 'P2');
      expect(queue.stats().totalEnqueued).toBe(2);
    });
  });

  // ─── Deduplicering ────────────────────────────────────────────

  describe('deduplicering', () => {
    it('deduplicerar liknande förfrågningar inom tidsfönster', () => {
      const id1 = queue.enqueue('code', 'Samma prompt');
      const id2 = queue.enqueue('code', 'Samma prompt');
      expect(id1).toBe(id2);
      expect(queue.size).toBe(1);
      expect(queue.stats().totalDeduplicated).toBe(1);
    });

    it('deduplicerar INTE för olika agenter', () => {
      const id1 = queue.enqueue('code', 'Samma prompt');
      const id2 = queue.enqueue('docs', 'Samma prompt');
      expect(id1).not.toBe(id2);
      expect(queue.size).toBe(2);
    });

    it('deduplicerar INTE för olika prompts', () => {
      queue.enqueue('code', 'Prompt A');
      queue.enqueue('code', 'Prompt B');
      expect(queue.size).toBe(2);
    });
  });

  // ─── Dequeue ──────────────────────────────────────────────────

  describe('dequeue', () => {
    it('tar ut nästa förfrågan i prioritetsordning', () => {
      queue.enqueue('a', 'Low prio', RequestPriority.Low);
      queue.enqueue('b', 'High prio', RequestPriority.High);

      const req = queue.dequeue();
      expect(req).toBeDefined();
      expect(req!.agentId).toBe('b');
      expect(req!.status).toBe('processing');
      expect(req!.startedAt).toBeDefined();
      expect(queue.size).toBe(1);
      expect(queue.activeCount).toBe(1);
    });

    it('returnerar undefined när kön är tom', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('returnerar undefined när pausad', () => {
      queue.enqueue('a', 'P1');
      queue.pause();
      expect(queue.dequeue()).toBeUndefined();
    });

    it('returnerar undefined vid max concurrency', () => {
      const q = createQueue({ maxConcurrent: 1 });
      q.enqueue('a', 'P1');
      q.enqueue('b', 'P2');
      q.dequeue(); // Första → processing
      expect(q.dequeue()).toBeUndefined(); // Max nått
    });
  });

  // ─── Complete / Fail ──────────────────────────────────────────

  describe('complete', () => {
    it('markerar förfrågan som klar', () => {
      queue.enqueue('code', 'Prompt');
      const req = queue.dequeue()!;
      queue.complete(req.id, { metadata: { ok: true } });

      expect(queue.activeCount).toBe(0);
      expect(queue.stats().totalProcessed).toBe(1);
    });

    it('emittar onDidProcess-event', () => {
      const handler = vi.fn();
      queue.onDidProcess(handler);
      queue.enqueue('code', 'Prompt');
      const req = queue.dequeue()!;
      queue.complete(req.id);
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].status).toBe('completed');
    });

    it('emittar onQueueDrain när allt klart', () => {
      const handler = vi.fn();
      queue.onQueueDrain(handler);
      queue.enqueue('code', 'Prompt');
      const req = queue.dequeue()!;
      queue.complete(req.id);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('ignorerar okänt request-id', () => {
      queue.complete('nonexistent');
      expect(queue.stats().totalProcessed).toBe(0);
    });
  });

  describe('fail', () => {
    it('markerar förfrågan som misslyckad', () => {
      queue.enqueue('code', 'Prompt');
      const req = queue.dequeue()!;
      queue.fail(req.id, 'Timeout');

      expect(queue.activeCount).toBe(0);
      expect(queue.stats().totalFailed).toBe(1);
    });

    it('sparar felmeddelande', () => {
      const handler = vi.fn();
      queue.onDidProcess(handler);
      queue.enqueue('code', 'Prompt');
      const req = queue.dequeue()!;
      queue.fail(req.id, 'Agent kraschade');

      expect(handler.mock.calls[0][0].error).toBe('Agent kraschade');
      expect(handler.mock.calls[0][0].status).toBe('failed');
    });

    it('ignorerar okänt request-id', () => {
      queue.fail('nonexistent', 'Error');
      expect(queue.stats().totalFailed).toBe(0);
    });
  });

  // ─── Cancel ───────────────────────────────────────────────────

  describe('cancel', () => {
    it('avbryter köad förfrågan', () => {
      const id = queue.enqueue('code', 'Prompt');
      const result = queue.cancel(id);
      expect(result).toBe(true);
      expect(queue.size).toBe(0);
      expect(queue.stats().totalCancelled).toBe(1);
    });

    it('emittar onDidCancel-event', () => {
      const handler = vi.fn();
      queue.onDidCancel(handler);
      const id = queue.enqueue('code', 'Prompt');
      queue.cancel(id);
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].status).toBe('cancelled');
    });

    it('returnerar false för okänt id', () => {
      expect(queue.cancel('nonexistent')).toBe(false);
    });

    it('cancelAll avbryter alla', () => {
      queue.enqueue('a', 'P1');
      queue.enqueue('b', 'P2');
      queue.enqueue('c', 'P3');
      const count = queue.cancelAll();
      expect(count).toBe(3);
      expect(queue.size).toBe(0);
      expect(queue.stats().totalCancelled).toBe(3);
    });
  });

  // ─── Pause / Resume ───────────────────────────────────────────

  describe('pause / resume', () => {
    it('pausar och återupptar kön', () => {
      queue.enqueue('code', 'Prompt');
      queue.pause();
      expect(queue.isPaused).toBe(true);
      expect(queue.dequeue()).toBeUndefined();

      queue.resume();
      expect(queue.isPaused).toBe(false);
      expect(queue.dequeue()).toBeDefined();
    });
  });

  // ─── Query ────────────────────────────────────────────────────

  describe('query', () => {
    it('get hittar förfrågan i kö', () => {
      const id = queue.enqueue('code', 'Prompt');
      expect(queue.get(id)).toBeDefined();
      expect(queue.get(id)!.agentId).toBe('code');
    });

    it('get hittar förfrågan under bearbetning', () => {
      queue.enqueue('code', 'Prompt');
      const req = queue.dequeue()!;
      const found = queue.get(req.id);
      expect(found).toBeDefined();
      expect(found!.status).toBe('processing');
    });

    it('get returnerar undefined för okänt id', () => {
      expect(queue.get('nonexistent')).toBeUndefined();
    });

    it('position returnerar korrekt index', () => {
      queue.enqueue('a', 'P1');
      const id2 = queue.enqueue('b', 'P2');
      expect(queue.position(id2)).toBe(1);
    });

    it('position returnerar -1 för okänt id', () => {
      expect(queue.position('nonexistent')).toBe(-1);
    });

    it('pending returnerar alla köade', () => {
      queue.enqueue('a', 'P1');
      queue.enqueue('b', 'P2');
      expect(queue.pending()).toHaveLength(2);
    });

    it('active returnerar pågående', () => {
      queue.enqueue('a', 'P1');
      queue.dequeue();
      expect(queue.active()).toHaveLength(1);
    });

    it('all returnerar köade + pågående', () => {
      queue.enqueue('a', 'P1');
      queue.enqueue('b', 'P2');
      queue.dequeue(); // a → processing
      expect(queue.all()).toHaveLength(2);
    });
  });

  // ─── Statistik ────────────────────────────────────────────────

  describe('statistik', () => {
    it('beräknar korrekt statistik', () => {
      queue.enqueue('a', 'P1');
      queue.enqueue('b', 'P2');
      const req = queue.dequeue()!;
      queue.complete(req.id);

      const s = queue.stats();
      expect(s.totalEnqueued).toBe(2);
      expect(s.totalProcessed).toBe(1);
      expect(s.currentQueueSize).toBe(1);
      expect(s.currentProcessing).toBe(0);
    });

    it('resetStats nollställer statistik', () => {
      queue.enqueue('a', 'P1');
      queue.resetStats();
      const s = queue.stats();
      expect(s.totalEnqueued).toBe(0);
    });
  });

  // ─── UI (QuickPick) ──────────────────────────────────────────

  describe('showQueueStatus', () => {
    it('visar info-meddelande vid tom kö', async () => {
      const showInfo = vi.spyOn(
        (await import('vscode')).window,
        'showInformationMessage'
      );
      await queue.showQueueStatus();
      expect(showInfo).toHaveBeenCalledWith(
        'Kön är tom. Inga väntande förfrågningar.'
      );
    });

    it('visar QuickPick med förfrågningar', async () => {
      const showPick = vi.spyOn(
        (await import('vscode')).window,
        'showQuickPick'
      );
      queue.enqueue('code', 'Prompt 1');
      queue.enqueue('docs', 'Prompt 2');
      await queue.showQueueStatus();
      expect(showPick).toHaveBeenCalledOnce();
    });
  });

  describe('showQueueStats', () => {
    it('öppnar dokument med statistik', async () => {
      const openDoc = vi.spyOn(
        (await import('vscode')).workspace,
        'openTextDocument'
      );
      await queue.showQueueStats();
      expect(openDoc).toHaveBeenCalled();
    });
  });

  // ─── Middleware ───────────────────────────────────────────────

  describe('middleware', () => {
    it('skapar middleware med rätt namn och prioritet', () => {
      const mw = queue.createMiddleware();
      expect(mw.name).toBe('request-queue');
      expect(mw.priority).toBe(5);
      expect(mw.before).toBeDefined();
    });
  });

  // ─── Clear / Dispose ──────────────────────────────────────────

  describe('clear & dispose', () => {
    it('clear rensar kö och statistik', () => {
      queue.enqueue('a', 'P1');
      queue.enqueue('b', 'P2');
      queue.clear();
      expect(queue.size).toBe(0);
      expect(queue.stats().totalEnqueued).toBe(0);
    });

    it('dispose rensar och avregistrerar events', () => {
      queue.enqueue('a', 'P1');
      queue.dispose();
      expect(queue.size).toBe(0);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('drain emitteras inte vid fail om kö ej tom', () => {
      const handler = vi.fn();
      queue.onQueueDrain(handler);
      queue.enqueue('a', 'P1');
      queue.enqueue('b', 'P2');
      const req = queue.dequeue()!;
      queue.fail(req.id, 'Error');
      expect(handler).not.toHaveBeenCalled(); // Kö har fortfarande 1
    });

    it('drain emitteras vid fail om kö tom', () => {
      const handler = vi.fn();
      queue.onQueueDrain(handler);
      queue.enqueue('a', 'P1');
      const req = queue.dequeue()!;
      queue.fail(req.id, 'Error');
      expect(handler).toHaveBeenCalledOnce();
    });

    it('multipla dequeue respekterar maxConcurrent', () => {
      const q = createQueue({ maxConcurrent: 2 });
      q.enqueue('a', 'P1');
      q.enqueue('b', 'P2');
      q.enqueue('c', 'P3');

      expect(q.dequeue()).toBeDefined();
      expect(q.dequeue()).toBeDefined();
      expect(q.dequeue()).toBeUndefined(); // Max 2 nått
      expect(q.activeCount).toBe(2);
    });
  });
});
