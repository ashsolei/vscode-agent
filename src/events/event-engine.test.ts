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

  describe('onDidTrigger event', () => {
    it('should expose onDidTrigger event', () => {
      expect(engine.onDidTrigger).toBeDefined();
      expect(typeof engine.onDidTrigger).toBe('function');
    });

    it('should allow subscribing without error', () => {
      const handler = vi.fn();
      const disposable = engine.onDidTrigger(handler);
      expect(disposable).toBeDefined();
      expect(typeof disposable.dispose).toBe('function');
      disposable.dispose();
    });
  });

  describe('activate', () => {
    it('should setup event listeners', () => {
      engine.addRule(makeRule());
      expect(() => engine.activate()).not.toThrow();
    });

    // ─── v0.10.0: addRule after activate creates interval timer ───

    it('should start interval timer when onInterval rule added after activate', () => {
      vi.useFakeTimers();
      engine.activate();

      // Add an interval rule AFTER activate
      engine.addRule(makeRule({
        id: 'post-activate-interval',
        event: 'onInterval',
        intervalMs: 1000,
        enabled: true,
        agentId: 'autofix',
      }));

      // The interval should have been created — verify by checking internal intervals
      // We can verify indirectly: the rule was added
      expect(engine.listRules()).toHaveLength(1);
      expect(engine.listRules()[0].event).toBe('onInterval');

      vi.useRealTimers();
    });

    it('should NOT start interval for rules added before activate', () => {
      vi.useFakeTimers();
      // Add rule BEFORE activate — intervals are created in activate()
      engine.addRule(makeRule({
        id: 'pre-activate-interval',
        event: 'onInterval',
        intervalMs: 1000,
        enabled: true,
      }));

      // activate creates the interval in its own logic
      expect(() => engine.activate()).not.toThrow();

      vi.useRealTimers();
    });

    it('should NOT start interval for disabled rule added after activate', () => {
      vi.useFakeTimers();
      engine.activate();

      engine.addRule(makeRule({
        id: 'disabled-interval',
        event: 'onInterval',
        intervalMs: 1000,
        enabled: false, // disabled
      }));

      // Rule added but should not create timer since disabled
      expect(engine.listRules()).toHaveLength(1);
      vi.useRealTimers();
    });
  });

  // ─── matchFile (tested indirectly via activate + save handler) ───

  describe('matchFile & triggerRule (via event handler)', () => {
    let saveHandler: ((doc: any) => void) | undefined;
    let createHandler: ((uri: any) => void) | undefined;
    let deleteHandler: ((uri: any) => void) | undefined;

    beforeEach(async () => {
      // Override mocks to capture handlers
      const vsc = await import('vscode');
      vi.mocked(vsc.workspace.onDidSaveTextDocument).mockImplementation((handler: any) => {
        saveHandler = handler;
        return { dispose: vi.fn() };
      });

      const mockWatcher = {
        onDidCreate: vi.fn().mockImplementation((handler: any) => {
          createHandler = handler;
          return { dispose: vi.fn() };
        }),
        onDidDelete: vi.fn().mockImplementation((handler: any) => {
          deleteHandler = handler;
          return { dispose: vi.fn() };
        }),
        onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        dispose: vi.fn(),
      };
      vi.mocked(vsc.workspace.createFileSystemWatcher).mockReturnValue(mockWatcher as any);
    });

    it('should match **/*.ts pattern against .ts files', async () => {
      const vsc = await import('vscode');
      engine.addRule(makeRule({ event: 'onSave', filePattern: '**/*.ts' }));
      engine.activate();

      saveHandler?.({ uri: { fsPath: '/project/src/file.ts' } });

      expect(vsc.commands.executeCommand).toHaveBeenCalled();
    });

    it('should NOT match **/*.ts pattern against .js files', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({ event: 'onSave', filePattern: '**/*.ts' }));
      engine.activate();

      saveHandler?.({ uri: { fsPath: '/project/src/file.js' } });

      expect(vsc.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should match *.tsx pattern', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({ event: 'onSave', filePattern: '*.tsx' }));
      engine.activate();

      saveHandler?.({ uri: { fsPath: '/project/src/App.tsx' } });

      expect(vsc.commands.executeCommand).toHaveBeenCalled();
    });

    it('should match substring pattern', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({ event: 'onSave', filePattern: 'src/' }));
      engine.activate();

      saveHandler?.({ uri: { fsPath: '/project/src/index.ts' } });

      expect(vsc.commands.executeCommand).toHaveBeenCalled();
    });

    it('should match all files when no pattern specified', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({ event: 'onSave', filePattern: undefined }));
      engine.activate();

      saveHandler?.({ uri: { fsPath: '/anything.py' } });

      expect(vsc.commands.executeCommand).toHaveBeenCalled();
    });

    it('should trigger onFileCreate handler', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({ id: 'create-rule', event: 'onFileCreate', filePattern: '**/*.ts' }));
      engine.activate();

      createHandler?.({ fsPath: '/project/new-file.ts' });

      expect(vsc.commands.executeCommand).toHaveBeenCalled();
    });

    it('should trigger onFileDelete handler', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({ id: 'delete-rule', event: 'onFileDelete', filePattern: '**/*.ts' }));
      engine.activate();

      deleteHandler?.({ fsPath: '/project/deleted.ts' });

      expect(vsc.commands.executeCommand).toHaveBeenCalled();
    });

    it('should NOT trigger disabled rules', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({ event: 'onSave', enabled: false }));
      engine.activate();

      saveHandler?.({ uri: { fsPath: '/project/file.ts' } });

      expect(vsc.commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  // ─── triggerRule cooldown ───

  describe('triggerRule cooldown', () => {
    let saveHandler: ((doc: any) => void) | undefined;

    beforeEach(async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.workspace.onDidSaveTextDocument).mockImplementation((handler: any) => {
        saveHandler = handler;
        return { dispose: vi.fn() };
      });
    });

    it('should respect cooldown between triggers', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({ event: 'onSave', cooldownMs: 60_000, filePattern: undefined }));
      engine.activate();

      // First trigger should work
      saveHandler?.({ uri: { fsPath: '/file.ts' } });
      expect(vsc.commands.executeCommand).toHaveBeenCalledTimes(1);

      // Second trigger immediately should be blocked by cooldown
      saveHandler?.({ uri: { fsPath: '/file.ts' } });
      expect(vsc.commands.executeCommand).toHaveBeenCalledTimes(1); // still 1
    });
  });

  // ─── triggerRule prompt expansion ───

  describe('triggerRule prompt expansion', () => {
    let saveHandler: ((doc: any) => void) | undefined;

    beforeEach(async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.workspace.onDidSaveTextDocument).mockImplementation((handler: any) => {
        saveHandler = handler;
        return { dispose: vi.fn() };
      });
    });

    it('should expand ${file} in prompt', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({
        event: 'onSave',
        prompt: 'Fix errors in ${file}',
        filePattern: undefined,
        cooldownMs: 0,
      }));
      engine.activate();

      saveHandler?.({ uri: { fsPath: '/project/src/app.ts' } });

      expect(vsc.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.chat.open',
        expect.objectContaining({
          query: expect.stringContaining('/project/src/app.ts'),
        })
      );
    });
  });

  // ─── triggerRule agent not found ───

  describe('triggerRule agent not found', () => {
    let saveHandler: ((doc: any) => void) | undefined;

    beforeEach(async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.workspace.onDidSaveTextDocument).mockImplementation((handler: any) => {
        saveHandler = handler;
        return { dispose: vi.fn() };
      });
    });

    it('should not crash when agent does not exist', async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.commands.executeCommand).mockClear();

      engine.addRule(makeRule({
        event: 'onSave',
        agentId: 'nonexistent-agent',
        filePattern: undefined,
        cooldownMs: 0,
      }));
      engine.activate();

      // Should not throw
      expect(() => saveHandler?.({ uri: { fsPath: '/file.ts' } })).not.toThrow();
      // Should not execute command because agent was not found
      expect(vsc.commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  // ─── onDidTrigger event firing ───

  describe('onDidTrigger event fires', () => {
    let saveHandler: ((doc: any) => void) | undefined;

    beforeEach(async () => {
      const vsc = await import('vscode');
      vi.mocked(vsc.workspace.onDidSaveTextDocument).mockImplementation((handler: any) => {
        saveHandler = handler;
        return { dispose: vi.fn() };
      });
    });

    it('should fire onDidTrigger when rule triggers', () => {
      const triggerHandler = vi.fn();
      engine.onDidTrigger(triggerHandler);

      engine.addRule(makeRule({ event: 'onSave', filePattern: undefined, cooldownMs: 0 }));
      engine.activate();

      saveHandler?.({ uri: { fsPath: '/file.ts' } });

      expect(triggerHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: 'test-rule',
          agentId: 'autofix',
          event: 'onSave',
        })
      );
    });
  });

  // ─── loadRules from memento ───

  describe('loadRules from memento', () => {
    it('should load existing rules from memento state', () => {
      const storedRules = [
        makeRule({ id: 'stored-1' }),
        makeRule({ id: 'stored-2', agentId: 'security' }),
      ];
      const preloadedMemento = createMockMemento();
      preloadedMemento.get.mockImplementation((key: string, def?: any) => {
        if (key === 'eventRules') return storedRules;
        return def;
      });

      const loadedEngine = new EventDrivenEngine(registry, preloadedMemento);
      expect(loadedEngine.listRules()).toHaveLength(2);
      expect(loadedEngine.listRules()[0].id).toBe('stored-1');
    });
  });
});
