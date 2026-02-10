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
    await telemetry.log(makeEntry());
    expect(memento.update).toHaveBeenCalled();
  });

  it('should track failure stats', async () => {
    await telemetry.log(makeEntry({ success: false, error: 'timeout' }));

    const stats = telemetry.agentStats();
    expect(stats['code'].failCount).toBe(1);
    expect(stats['code'].successCount).toBe(0);
  });
});
