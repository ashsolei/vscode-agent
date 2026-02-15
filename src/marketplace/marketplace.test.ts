import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentMarketplace } from './agent-marketplace';

/**
 * Tests for Marketplace → PluginLoader wiring (v0.4.0 Feature #2).
 * Validates that install/uninstall callbacks are properly invoked.
 */

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

describe('AgentMarketplace — callback wiring', () => {
  let memento: any;
  let installCallback: ReturnType<typeof vi.fn>;
  let uninstallCallback: ReturnType<typeof vi.fn>;
  let marketplace: AgentMarketplace;

  beforeEach(() => {
    memento = createMockMemento();
    installCallback = vi.fn();
    uninstallCallback = vi.fn();
    marketplace = new AgentMarketplace(memento, installCallback, uninstallCallback);
  });

  it('should create marketplace with install/uninstall callbacks', () => {
    expect(marketplace).toBeDefined();
  });

  it('should list community agents via browse()', () => {
    const agents = marketplace.browse();
    expect(agents.length).toBeGreaterThan(0);
  });

  it('should call onInstall callback when installing a community agent', async () => {
    const community = marketplace.browse();
    const agent = community[0];

    await marketplace.install(agent.id);
    expect(installCallback).toHaveBeenCalledTimes(1);
    expect(installCallback).toHaveBeenCalledWith(agent.pluginData);
  });

  it('should call onUninstall callback when uninstalling', async () => {
    const community = marketplace.browse();
    const agent = community[0];

    await marketplace.install(agent.id);
    const pluginId = agent.pluginData?.id ?? agent.id;
    await marketplace.uninstall(pluginId);

    expect(uninstallCallback).toHaveBeenCalledTimes(1);
  });

  it('should track installed agents locally', async () => {
    const community = marketplace.browse();
    const agent = community[0];

    await marketplace.install(agent.id);
    expect(memento.update).toHaveBeenCalled();
  });

  it('should not install unknown agent', async () => {
    const result = await marketplace.install('nonexistent-agent');
    expect(result).toBe(false);
    expect(installCallback).not.toHaveBeenCalled();
  });
});
