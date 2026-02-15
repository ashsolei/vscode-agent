import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventDrivenEngine } from './event-engine';

/**
 * Tests for default rule registration (v0.4.0 Feature #4).
 * Validates that predefined rules can be bulk-registered and configured.
 */

function createMockRegistry() {
  const agents = new Map<string, any>();
  agents.set('autofix', { id: 'autofix', name: 'AutoFix Agent' });
  agents.set('security', { id: 'security', name: 'Security Agent' });
  agents.set('explain', { id: 'explain', name: 'Explain Agent' });

  return {
    get: vi.fn((id: string) => agents.get(id)),
    resolve: vi.fn(),
    list: vi.fn(() => [...agents.values()]),
  } as any;
}

function createMockMemento() {
  const store: Record<string, any> = {};
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

describe('EventDrivenEngine — default rules registration', () => {
  let engine: EventDrivenEngine;
  let registry: any;
  let memento: any;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    memento = createMockMemento();
    engine = new EventDrivenEngine(registry, memento);
  });

  it('should register all predefined rules in bulk', () => {
    const defaultRules = [
      EventDrivenEngine.autoFixOnSave(),
      EventDrivenEngine.securityOnNewFile(),
      EventDrivenEngine.docsOnErrors(),
    ];

    for (const rule of defaultRules) {
      engine.addRule(rule);
    }

    expect(engine.listRules()).toHaveLength(3);
    const ruleIds = engine.listRules().map(r => r.id);
    expect(ruleIds).toContain('autofix-on-save');
    expect(ruleIds).toContain('security-new-file');
    expect(ruleIds).toContain('docs-on-errors');
  });

  it('should allow enabling individual rules via override', () => {
    const rule = EventDrivenEngine.autoFixOnSave();
    expect(rule.enabled).toBe(false); // disabled by default

    // Simulate config enabling
    rule.enabled = true;
    engine.addRule(rule);

    expect(engine.listRules()[0].enabled).toBe(true);
  });

  it('should keep rules disabled when config says so', () => {
    const rules = [
      EventDrivenEngine.autoFixOnSave(),
      EventDrivenEngine.securityOnNewFile(),
      EventDrivenEngine.docsOnErrors(),
    ];

    // All disabled by default
    for (const rule of rules) {
      engine.addRule(rule);
    }

    for (const rule of engine.listRules()) {
      expect(rule.enabled).toBe(false);
    }
  });

  it('should activate successfully after adding default rules', () => {
    const rules = [
      EventDrivenEngine.autoFixOnSave(),
      EventDrivenEngine.securityOnNewFile(),
      EventDrivenEngine.docsOnErrors(),
    ];

    for (const rule of rules) {
      engine.addRule(rule);
    }

    expect(() => engine.activate()).not.toThrow();
    expect(() => engine.dispose()).not.toThrow();
  });

  it('should persist all default rules to memento', () => {
    const rules = [
      EventDrivenEngine.autoFixOnSave(),
      EventDrivenEngine.securityOnNewFile(),
      EventDrivenEngine.docsOnErrors(),
    ];

    for (const rule of rules) {
      engine.addRule(rule);
    }

    // addRule calls persistRules which calls memento.update
    expect(memento.update).toHaveBeenCalledTimes(3);
    const lastCall = memento.update.mock.calls[2];
    expect(lastCall[0]).toBe('eventRules');
    expect(lastCall[1]).toHaveLength(3);
  });
});
