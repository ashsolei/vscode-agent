import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventDrivenEngine, EventRule } from './event-engine';
import { AgentRegistry } from '../agents/index';

// Create a minimal mock for AgentRegistry
function createMockRegistry() {
  const agents = new Map<string, any>();
  agents.set('autofix', { id: 'autofix', name: 'AutoFix Agent' });
  agents.set('security', { id: 'security', name: 'Security Agent' });

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

function makeRule(overrides: Partial<EventRule> = {}): EventRule {
  return {
    id: 'test-rule',
    event: 'onSave',
    filePattern: '**/*.ts',
    agentId: 'autofix',
    prompt: 'Fix errors in ${file}',
    enabled: true,
    cooldownMs: 10_000,
    ...overrides,
  };
}

describe('EventDrivenEngine', () => {
  let engine: EventDrivenEngine;
  let registry: any;
  let memento: any;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    memento = createMockMemento();
    engine = new EventDrivenEngine(registry, memento);
  });

  describe('rule management', () => {
    it('should add a rule', () => {
      engine.addRule(makeRule());
      expect(engine.listRules().length).toBe(1);
      expect(engine.listRules()[0].id).toBe('test-rule');
    });

    it('should remove a rule', () => {
      engine.addRule(makeRule({ id: 'r1' }));
      engine.addRule(makeRule({ id: 'r2' }));
      expect(engine.listRules().length).toBe(2);

      const removed = engine.removeRule('r1');
      expect(removed).toBe(true);
      expect(engine.listRules().length).toBe(1);
      expect(engine.listRules()[0].id).toBe('r2');
    });

    it('should return false when removing non-existent rule', () => {
      const removed = engine.removeRule('nonexistent');
      expect(removed).toBe(false);
    });

    it('should toggle rule enabled state', () => {
      engine.addRule(makeRule({ id: 'toggle-me', enabled: true }));

      engine.toggleRule('toggle-me', false);
      expect(engine.listRules()[0].enabled).toBe(false);

      engine.toggleRule('toggle-me', true);
      expect(engine.listRules()[0].enabled).toBe(true);
    });

    it('should persist rules after each mutation', () => {
      engine.addRule(makeRule());
      expect(memento.update).toHaveBeenCalledWith('eventRules', expect.any(Array));
    });

    it('should return a copy of rules list', () => {
      engine.addRule(makeRule());
      const list = engine.listRules();
      list.push(makeRule({ id: 'extra' }));
      expect(engine.listRules().length).toBe(1);
    });
  });

  describe('predefined rules', () => {
    it('should have autofix on save rule', () => {
      const rule = EventDrivenEngine.autoFixOnSave();
      expect(rule.id).toBe('autofix-on-save');
      expect(rule.event).toBe('onSave');
      expect(rule.agentId).toBe('autofix');
      expect(rule.enabled).toBe(false); // disabled by default
    });

    it('should have security on new file rule', () => {
      const rule = EventDrivenEngine.securityOnNewFile();
      expect(rule.id).toBe('security-new-file');
      expect(rule.event).toBe('onFileCreate');
      expect(rule.agentId).toBe('security');
    });

    it('should have docs on errors rule', () => {
      const rule = EventDrivenEngine.docsOnErrors();
      expect(rule.id).toBe('docs-on-errors');
      expect(rule.event).toBe('onDiagnostics');
      expect(rule.minSeverity).toBe('error');
    });
  });

  describe('dispose', () => {
    it('should dispose without error', () => {
      engine.activate();
      expect(() => engine.dispose()).not.toThrow();
    });

    it('should clear intervals on dispose', () => {
      vi.useFakeTimers();
      engine.addRule(makeRule({
        id: 'interval-rule',
        event: 'onInterval',
        intervalMs: 5000,
      }));
      engine.activate();
      engine.dispose();
      vi.useRealTimers();
    });
  });

  describe('activate', () => {
    it('should setup event listeners', () => {
      engine.addRule(makeRule());
      expect(() => engine.activate()).not.toThrow();
    });
  });
});
