import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentProfileManager, AgentProfile } from '../profiles/agent-profiles';

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

describe('AgentProfileManager', () => {
  let manager: AgentProfileManager;
  let memento: any;

  beforeEach(() => {
    memento = createMockMemento();
    manager = new AgentProfileManager(memento);
  });

  it('should have builtin profiles', () => {
    const profiles = manager.list();
    expect(profiles.length).toBeGreaterThanOrEqual(6);
    const ids = profiles.map((p) => p.id);
    expect(ids).toContain('frontend');
    expect(ids).toContain('backend');
    expect(ids).toContain('review');
    expect(ids).toContain('fullstack');
    expect(ids).toContain('learning');
    expect(ids).toContain('devops');
  });

  it('should start with no active profile', () => {
    expect(manager.active).toBeUndefined();
  });

  it('should activate a profile', async () => {
    const result = await manager.activate('frontend');
    expect(result).toBe(true);
    expect(manager.active?.id).toBe('frontend');
    expect(manager.active?.name).toBe('Frontend Mode');
  });

  it('should fail to activate non-existent profile', async () => {
    const result = await manager.activate('nonexistent');
    expect(result).toBe(false);
  });

  it('should deactivate profile', async () => {
    await manager.activate('frontend');
    await manager.deactivate();
    expect(manager.active).toBeUndefined();
  });

  it('should create custom profile', async () => {
    const profile = await manager.create({
      id: 'custom',
      name: 'Custom Profile',
      icon: '🛠️',
      description: 'Test profile',
      agents: ['code', 'test'],
      guardLevel: 'strict',
    });

    expect(profile.id).toBe('custom');
    expect(manager.list().map((p) => p.id)).toContain('custom');
  });

  it('should remove custom profile', async () => {
    await manager.create({
      id: 'removable',
      name: 'Removable',
      icon: '❌',
      description: 'Will be removed',
      agents: ['code'],
    });

    const removed = await manager.remove('removable');
    expect(removed).toBe(true);
    expect(manager.list().map((p) => p.id)).not.toContain('removable');
  });

  it('should not remove builtin profiles', async () => {
    const removed = await manager.remove('frontend');
    expect(removed).toBe(false);
  });

  it('should duplicate a profile', async () => {
    const copy = await manager.duplicate('frontend', 'my-frontend', 'My Frontend');
    expect(copy).toBeDefined();
    expect(copy!.id).toBe('my-frontend');
    expect(copy!.name).toBe('My Frontend');
    expect(copy!.agents).toEqual(manager.list().find((p) => p.id === 'frontend')!.agents);
  });

  it('should mark active in list', async () => {
    await manager.activate('backend');
    const list = manager.list();
    const backend = list.find((p) => p.id === 'backend');
    const frontend = list.find((p) => p.id === 'frontend');
    expect(backend?.active).toBe(true);
    expect(frontend?.active).toBe(false);
  });

  it('should persist via memento', async () => {
    await manager.create({
      id: 'persisted',
      name: 'Persisted',
      icon: '💾',
      description: 'Test',
      agents: ['code'],
    });
    expect(memento.update).toHaveBeenCalled();
  });

  it('should emit onDidChange when activating', async () => {
    const listener = vi.fn();
    manager.onDidChange(listener);

    await manager.activate('frontend');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: 'frontend' }));
  });

  it('should emit onDidChange with guardLevel when profile has it', async () => {
    await manager.create({
      id: 'strict-profile',
      name: 'Strict Mode',
      icon: '🔒',
      description: 'Strict guardrails',
      agents: ['code', 'review'],
      guardLevel: 'strict',
    });
    const listener = vi.fn();
    manager.onDidChange(listener);
    await manager.activate('strict-profile');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'strict-profile', guardLevel: 'strict' }),
    );
  });

  it('should emit onDidChange with models when profile has models config', async () => {
    await manager.create({
      id: 'model-profile',
      name: 'Model Override',
      icon: '🤖',
      description: 'Custom models',
      agents: ['code'],
      models: { default: 'gpt-4o', code: 'claude-sonnet' },
    });
    const listener = vi.fn();
    manager.onDidChange(listener);
    await manager.activate('model-profile');
    const emitted = listener.mock.calls[0][0];
    expect(emitted.models).toEqual({ default: 'gpt-4o', code: 'claude-sonnet' });
  });

  it('should emit onDidChange with middleware when profile has it', async () => {
    await manager.create({
      id: 'mw-profile',
      name: 'MW Profile',
      icon: '⚙️',
      description: 'Middleware config',
      agents: ['code'],
      middleware: ['logging', 'timing'],
    });
    const listener = vi.fn();
    manager.onDidChange(listener);
    await manager.activate('mw-profile');
    const emitted = listener.mock.calls[0][0];
    expect(emitted.middleware).toEqual(['logging', 'timing']);
  });

  it('should emit undefined on deactivation', async () => {
    const listener = vi.fn();
    manager.onDidChange(listener);
    await manager.activate('frontend');
    await manager.deactivate();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0]).toBeUndefined();
  });

  it('should clean up on dispose', () => {
    expect(() => manager.dispose()).not.toThrow();
  });

  // ─── remove active profile ───

  it('should deactivate when removing the active profile', async () => {
    await manager.create({
      id: 'temp',
      name: 'Temp',
      icon: '🗑️',
      description: 'Temp',
      agents: ['code'],
    });
    await manager.activate('temp');
    expect(manager.active?.id).toBe('temp');

    await manager.remove('temp');
    expect(manager.active).toBeUndefined();
  });

  it('should return false when removing non-existent profile', async () => {
    const removed = await manager.remove('does-not-exist');
    expect(removed).toBe(false);
  });

  // ─── duplicate unknown ───

  it('should return undefined when duplicating unknown profile', async () => {
    const copy = await manager.duplicate('nonexistent', 'new-id', 'New');
    expect(copy).toBeUndefined();
  });

  // ─── load from memento ───

  it('should load custom profiles from memento', () => {
    const m = createMockMemento();
    const store: Record<string, any> = {
      'agent.profiles': [{ id: 'saved', name: 'Saved', icon: '💾', description: 'Test', agents: ['code'] }],
      'agent.activeProfile': 'saved',
    };
    m.get = vi.fn((key: string, def?: any) => store[key] ?? def);

    const mgr = new AgentProfileManager(m);
    const list = mgr.list();
    expect(list.map((p) => p.id)).toContain('saved');
    expect(mgr.active?.id).toBe('saved');
    mgr.dispose();
  });

  // ─── export profile ───

  it('should export profile to document', async () => {
    const vsc = await import('vscode');
    await manager.exportProfile('frontend');
    expect(vsc.workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'json' })
    );
  });

  it('should not crash when exporting non-existent profile', async () => {
    await expect(manager.exportProfile('nonexistent')).resolves.not.toThrow();
  });

  // ─── create duplicate id ───

  it('should overwrite profile with same id on create', async () => {
    await manager.create({
      id: 'dup',
      name: 'First',
      icon: '1️⃣',
      description: 'First',
      agents: ['code'],
    });
    await manager.create({
      id: 'dup',
      name: 'Second',
      icon: '2️⃣',
      description: 'Second',
      agents: ['test'],
    });
    const found = manager.list().find((p) => p.id === 'dup');
    expect(found?.name).toBe('Second');
    expect(found?.agents).toEqual(['test']);
  });

  // ─── dispose ───

  it('should handle double dispose safely', () => {
    manager.dispose();
    expect(() => manager.dispose()).not.toThrow();
  });
});
