import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TelemetryEngine, TelemetryEntry } from '../telemetry/telemetry-engine';

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

function makeEntry(overrides: Partial<TelemetryEntry> = {}): TelemetryEntry {
  return {
    agentId: 'code',
    agentName: 'Code Agent',
    command: 'code',
    timestamp: Date.now(),
    durationMs: 150,
    success: true,
    promptLength: 42,
    ...overrides,
  };
}

describe('TelemetryEngine', () => {
  let telemetry: TelemetryEngine;
  let memento: any;

  beforeEach(() => {
    memento = createMockMemento();
    telemetry = new TelemetryEngine(memento);
  });

  it('should log entries', async () => {
    await telemetry.log(makeEntry());
    expect(telemetry.totalEntries).toBe(1);
  });

  it('should provide overview stats', async () => {
    await telemetry.log(makeEntry({ success: true }));
    await telemetry.log(makeEntry({ success: true }));
    await telemetry.log(makeEntry({ success: false }));

    const overview = telemetry.overview();
    expect(overview.totalCalls).toBe(3);
    expect(overview.successRate).toBe(67);
    expect(overview.uniqueAgents).toBe(1);
  });

  it('should track per-agent stats', async () => {
    await telemetry.log(makeEntry({ agentId: 'code', durationMs: 100 }));
    await telemetry.log(makeEntry({ agentId: 'code', durationMs: 200 }));
    await telemetry.log(makeEntry({ agentId: 'docs', durationMs: 50 }));

    const stats = telemetry.agentStats();
    expect(stats['code'].calls).toBe(2);
    expect(stats['code'].avgDurationMs).toBe(150);
    expect(stats['docs'].calls).toBe(1);
  });

  it('should identify top agent', async () => {
    await telemetry.log(makeEntry({ agentId: 'code' }));
    await telemetry.log(makeEntry({ agentId: 'code' }));
    await telemetry.log(makeEntry({ agentId: 'docs' }));

    const overview = telemetry.overview();
    expect(overview.topAgent).toBe('code');
  });

  it('should clear entries', async () => {
    await telemetry.log(makeEntry());
    await telemetry.log(makeEntry());
    await telemetry.clear();

    expect(telemetry.totalEntries).toBe(0);
    expect(telemetry.overview().totalCalls).toBe(0);
  });

  it('should count last 24h', async () => {
    const now = Date.now();
    await telemetry.log(makeEntry({ timestamp: now }));
    await telemetry.log(makeEntry({ timestamp: now - 23 * 60 * 60 * 1000 }));
    await telemetry.log(makeEntry({ timestamp: now - 25 * 60 * 60 * 1000 })); // older

    const overview = telemetry.overview();
    expect(overview.last24h).toBe(2);
  });

  it('should produce daily summary', async () => {
    const now = Date.now();
    await telemetry.log(makeEntry({ timestamp: now }));
    await telemetry.log(makeEntry({ timestamp: now }));

    const daily = telemetry.dailySummary(1);
    expect(daily.length).toBeGreaterThanOrEqual(1);
    expect(daily[0].calls).toBe(2);
  });

  it('should persist data', async () => {
    vi.useFakeTimers();
    await telemetry.log(makeEntry());
    vi.advanceTimersByTime(5000);
    expect(memento.update).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should track failure stats', async () => {
    await telemetry.log(makeEntry({ success: false, error: 'timeout' }));

    const stats = telemetry.agentStats();
    expect(stats['code'].failCount).toBe(1);
    expect(stats['code'].successCount).toBe(0);
  });

  // ─── hourlyBreakdown ───

  describe('hourlyBreakdown', () => {
    it('should return hourly buckets', async () => {
      const now = Date.now();
      await telemetry.log(makeEntry({ timestamp: now, success: true }));
      await telemetry.log(makeEntry({ timestamp: now, success: false }));

      const breakdown = telemetry.hourlyBreakdown(1);
      expect(breakdown.length).toBeGreaterThanOrEqual(1);
      expect(breakdown[0].count).toBe(2);
      expect(breakdown[0].successRate).toBe(50);
      expect(breakdown[0].hour).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:00/);
    });

    it('should filter by days cutoff', async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      await telemetry.log(makeEntry({ timestamp: now }));
      await telemetry.log(makeEntry({ timestamp: now - 10 * day })); // older than 7 days

      const breakdown = telemetry.hourlyBreakdown(7);
      // Should only include the recent entry
      const totalCount = breakdown.reduce((sum, b) => sum + b.count, 0);
      expect(totalCount).toBe(1);
    });

    it('should return sorted by hour', async () => {
      const now = Date.now();
      const hour = 60 * 60 * 1000;
      await telemetry.log(makeEntry({ timestamp: now - 2 * hour }));
      await telemetry.log(makeEntry({ timestamp: now }));

      const breakdown = telemetry.hourlyBreakdown(1);
      if (breakdown.length >= 2) {
        expect(breakdown[0].hour < breakdown[1].hour).toBe(true);
      }
    });

    it('should return empty for no entries', () => {
      const breakdown = telemetry.hourlyBreakdown(7);
      expect(breakdown).toEqual([]);
    });
  });

  // ─── overview edge cases ───

  describe('overview edge cases', () => {
    it('should return topAgent as "-" with no entries', () => {
      const overview = telemetry.overview();
      expect(overview.topAgent).toBe('-');
      expect(overview.successRate).toBe(0);
      expect(overview.avgDuration).toBe(0);
      expect(overview.totalCalls).toBe(0);
    });

    it('should count last7d entries', async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      await telemetry.log(makeEntry({ timestamp: now }));
      await telemetry.log(makeEntry({ timestamp: now - 3 * day }));
      await telemetry.log(makeEntry({ timestamp: now - 6 * day }));
      await telemetry.log(makeEntry({ timestamp: now - 8 * day })); // older

      const overview = telemetry.overview();
      expect(overview.last7d).toBe(3);
    });

    it('should calculate avgDuration correctly', async () => {
      await telemetry.log(makeEntry({ durationMs: 100 }));
      await telemetry.log(makeEntry({ durationMs: 300 }));

      const overview = telemetry.overview();
      expect(overview.avgDuration).toBe(200);
    });
  });

  // ─── MAX_ENTRIES trimming ───

  describe('MAX_ENTRIES trimming', () => {
    it('should trim entries when exceeding 5000', async () => {
      // Log 5010 entries
      for (let i = 0; i < 5010; i++) {
        await telemetry.log(makeEntry({ timestamp: i }));
      }

      expect(telemetry.totalEntries).toBeLessThanOrEqual(5000);
    });

    it('should keep most recent entries when trimming', async () => {
      for (let i = 0; i < 5005; i++) {
        await telemetry.log(makeEntry({ timestamp: i, agentId: `agent-${i}` }));
      }

      // The oldest entries should be removed
      const stats = telemetry.agentStats();
      expect(stats['agent-0']).toBeUndefined(); // trimmed
      expect(stats['agent-5004']).toBeDefined(); // kept
    });
  });

  // ─── totalEntries getter ───

  it('should return correct totalEntries', async () => {
    expect(telemetry.totalEntries).toBe(0);
    await telemetry.log(makeEntry());
    expect(telemetry.totalEntries).toBe(1);
    await telemetry.log(makeEntry());
    expect(telemetry.totalEntries).toBe(2);
  });

  // ─── schedulePersist dedup ───

  describe('schedulePersist dedup', () => {
    it('should not create multiple persist timers', async () => {
      vi.useFakeTimers();
      // Log multiple times quickly — should only persist once
      await telemetry.log(makeEntry());
      await telemetry.log(makeEntry());
      await telemetry.log(makeEntry());

      vi.advanceTimersByTime(5000);

      // update may have been called for clear/other ops,
      // but persist timer should only fire once
      const persistCalls = memento.update.mock.calls.filter(
        (call: any[]) => call[0] === 'agent.telemetry'
      );
      expect(persistCalls.length).toBe(1);
      vi.useRealTimers();
    });
  });

  // ─── Load from existing state ───

  it('should load existing entries from memento', () => {
    const existing = [makeEntry({ agentId: 'existing' })];
    const m = createMockMemento();
    m.get.mockImplementation((key: string, def?: any) => {
      if (key === 'agent.telemetry') return existing;
      return def;
    });
    const t = new TelemetryEngine(m);
    expect(t.totalEntries).toBe(1);
    expect(t.agentStats()['existing']).toBeDefined();
  });

  // ─── Dispose ───

  describe('dispose', () => {
    it('should flush dirty writes on dispose', async () => {
      vi.useFakeTimers();
      await telemetry.log(makeEntry());
      // Timer is scheduled but not yet fired
      memento.update.mockClear();
      telemetry.dispose();

      // Should have flushed
      expect(memento.update).toHaveBeenCalledWith('agent.telemetry', expect.any(Array));
      vi.useRealTimers();
    });

    it('should not throw on dispose with no pending writes', () => {
      expect(() => telemetry.dispose()).not.toThrow();
    });

    it('should clear persist timer on dispose', async () => {
      vi.useFakeTimers();
      await telemetry.log(makeEntry());
      telemetry.dispose();
      // Advancing time should not cause issues
      vi.advanceTimersByTime(10000);
      vi.useRealTimers();
    });
  });

  // ─── show() ───

  describe('show', () => {
    it('should create webview panel', async () => {
      const vsc = await import('vscode');
      telemetry.show(vsc.Uri.file('/ext'));
      expect(vsc.window.createWebviewPanel).toHaveBeenCalledWith(
        'agentAnalytics',
        expect.any(String),
        expect.anything(),
        expect.objectContaining({ enableScripts: true })
      );
    });

    it('should reveal existing panel on second call', async () => {
      const vsc = await import('vscode');
      const mockPanel = {
        webview: { html: '' },
        reveal: vi.fn(),
        onDidDispose: vi.fn(),
        dispose: vi.fn(),
      };
      vi.mocked(vsc.window.createWebviewPanel).mockReturnValue(mockPanel as any);

      telemetry.show(vsc.Uri.file('/ext'));
      telemetry.show(vsc.Uri.file('/ext'));

      expect(mockPanel.reveal).toHaveBeenCalled();
    });
  });
});
