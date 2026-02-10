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

  it('should clean up on dispose', () => {
    expect(() => manager.dispose()).not.toThrow();
  });
});
