import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentMarketplace, MarketplaceAgent } from './agent-marketplace';

describe('AgentMarketplace', () => {
  let marketplace: AgentMarketplace;
  let mockState: Record<string, any>;
  let onInstallFn: ReturnType<typeof vi.fn>;
  let onUninstallFn: ReturnType<typeof vi.fn>;

  const createMockState = () => {
    mockState = {};
    return {
      get: vi.fn((key: string, defaultVal?: any) => mockState[key] ?? defaultVal),
      update: vi.fn(async (key: string, val: any) => { mockState[key] = val; }),
      keys: vi.fn(() => Object.keys(mockState)),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    onInstallFn = vi.fn();
    onUninstallFn = vi.fn();
    marketplace = new AgentMarketplace(
      createMockState() as any,
      onInstallFn,
      onUninstallFn
    );
  });

  describe('browse', () => {
    it('should return built-in community agents', () => {
      const agents = marketplace.browse();
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should sort by downloads by default', () => {
      const agents = marketplace.browse();
      for (let i = 1; i < agents.length; i++) {
        expect(agents[i - 1].downloads).toBeGreaterThanOrEqual(agents[i].downloads);
      }
    });

    it('should sort by rating', () => {
      const agents = marketplace.browse({ sort: 'rating' });
      for (let i = 1; i < agents.length; i++) {
        expect(agents[i - 1].rating).toBeGreaterThanOrEqual(agents[i].rating);
      }
    });

    it('should sort by recent update', () => {
      const agents = marketplace.browse({ sort: 'recent' });
      for (let i = 1; i < agents.length; i++) {
        expect(agents[i - 1].updatedAt).toBeGreaterThanOrEqual(agents[i].updatedAt);
      }
    });

    it('should filter by tag', () => {
      const agents = marketplace.browse({ tag: 'sql' });
      expect(agents.length).toBeGreaterThan(0);
      for (const agent of agents) {
        expect(agent.tags).toContain('sql');
      }
    });

    it('should return empty for nonexistent tag', () => {
      const agents = marketplace.browse({ tag: 'nonexistent-tag-xyz' });
      expect(agents).toHaveLength(0);
    });

    it('should mark installed agents', () => {
      const agents = marketplace.browse();
      for (const agent of agents) {
        expect(agent.installed).toBe(false);
      }
    });
  });

  describe('search', () => {
    it('should search by name', () => {
      const results = marketplace.search('Regex');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Regex');
    });

    it('should search by description', () => {
      const results = marketplace.search('query');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search by tag', () => {
      const results = marketplace.search('database');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive', () => {
      const upper = marketplace.search('SQL');
      const lower = marketplace.search('sql');
      expect(upper.length).toBe(lower.length);
    });

    it('should return empty for no match', () => {
      const results = marketplace.search('zzz_no_match_zzz');
      expect(results).toHaveLength(0);
    });
  });

  describe('install', () => {
    it('should install an agent from marketplace', async () => {
      const agents = marketplace.browse();
      const targetId = agents[0].id;

      const result = await marketplace.install(targetId);
      expect(result).toBe(true);
      expect(onInstallFn).toHaveBeenCalledWith(agents[0].pluginData);
    });

    it('should return false for nonexistent agent', async () => {
      const result = await marketplace.install('nonexistent-id');
      expect(result).toBe(false);
    });

    it('should save to local state after install', async () => {
      const agents = marketplace.browse();
      await marketplace.install(agents[0].id);

      const installed = marketplace.listInstalled();
      expect(installed.length).toBe(1);
    });

    it('should increment downloads counter', async () => {
      const agents = marketplace.browse();
      const initialDownloads = agents[0].downloads;
      await marketplace.install(agents[0].id);

      const updated = marketplace.browse();
      const agent = updated.find(a => a.id === agents[0].id);
      expect(agent!.downloads).toBe(initialDownloads + 1);
    });
  });

  describe('uninstall', () => {
    it('should uninstall an installed agent', async () => {
      const agents = marketplace.browse();
      await marketplace.install(agents[0].id);
      const pluginId = agents[0].pluginData?.id ?? agents[0].id;

      const result = await marketplace.uninstall(pluginId);
      expect(result).toBe(true);
      expect(onUninstallFn).toHaveBeenCalledWith(pluginId);
    });

    it('should return false for non-installed agent', async () => {
      const result = await marketplace.uninstall('not-installed');
      expect(result).toBe(false);
    });

    it('should remove from installed list', async () => {
      const agents = marketplace.browse();
      await marketplace.install(agents[0].id);
      const pluginId = agents[0].pluginData?.id ?? agents[0].id;

      expect(marketplace.listInstalled().length).toBe(1);
      await marketplace.uninstall(pluginId);
      expect(marketplace.listInstalled().length).toBe(0);
    });
  });

  describe('listInstalled', () => {
    it('should return empty initially', () => {
      expect(marketplace.listInstalled()).toHaveLength(0);
    });

    it('should return installed agents', async () => {
      const agents = marketplace.browse();
      await marketplace.install(agents[0].id);
      await marketplace.install(agents[1].id);

      const installed = marketplace.listInstalled();
      expect(installed.length).toBe(2);
    });

    it('should include version and install timestamp', async () => {
      const agents = marketplace.browse();
      await marketplace.install(agents[0].id);

      const installed = marketplace.listInstalled();
      expect(installed[0]).toHaveProperty('version');
      expect(installed[0]).toHaveProperty('installedAt');
      expect(installed[0].installedAt).toBeGreaterThan(0);
    });
  });

  describe('publish', () => {
    it('should reject plugin without id', async () => {
      const result = await marketplace.publish({ name: 'test' });
      expect(result).toBe(false);
    });

    it('should reject plugin without name', async () => {
      const result = await marketplace.publish({ id: 'test' });
      expect(result).toBe(false);
    });

    it('should reject empty plugin', async () => {
      const result = await marketplace.publish({});
      expect(result).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should not throw on dispose', () => {
      expect(() => marketplace.dispose()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      marketplace.dispose();
      marketplace.dispose();
    });
  });

  describe('rate', () => {
    it('should update rating with running average', async () => {
      const vsc = await import('vscode');
      const agents = marketplace.browse();
      const target = agents[0];
      const originalRating = target.rating;
      const originalCount = target.ratingCount;

      vi.mocked(vsc.window.showQuickPick).mockResolvedValueOnce('⭐⭐⭐⭐⭐ (5)' as any);
      await marketplace.rate(target.id);

      const updated = marketplace.browse().find(a => a.id === target.id)!;
      expect(updated.ratingCount).toBe(originalCount + 1);
      // Running average adjusts toward 5
      const expectedRating = Math.round(((originalRating * originalCount + 5) / (originalCount + 1)) * 10) / 10;
      expect(updated.rating).toBe(expectedRating);
    });

    it('should not crash for nonexistent agent', async () => {
      await expect(marketplace.rate('nonexistent')).resolves.not.toThrow();
    });

    it('should handle cancelled picker', async () => {
      const vsc = await import('vscode');
      const agents = marketplace.browse();
      vi.mocked(vsc.window.showQuickPick).mockResolvedValueOnce(undefined as any);
      await expect(marketplace.rate(agents[0].id)).resolves.not.toThrow();
    });
  });

  describe('browse with installed marking', () => {
    it('should mark installed agents as installed', async () => {
      const agents = marketplace.browse();
      await marketplace.install(agents[0].id);

      const refreshed = marketplace.browse();
      const installed = refreshed.find(a => a.id === agents[0].id);
      expect(installed!.installed).toBe(true);
    });

    it('should mark non-installed agents as not installed', async () => {
      const agents = marketplace.browse();
      await marketplace.install(agents[0].id);

      const refreshed = marketplace.browse();
      const notInstalled = refreshed.find(a => a.id !== agents[0].id);
      expect(notInstalled!.installed).toBe(false);
    });
  });

  describe('load from existing state', () => {
    it('should load installed agents from memento', () => {
      const state = createMockState();
      const saved = [{ id: 'regex-helper', version: '1.0.0', installedAt: 1000, pluginData: {} }];
      (state.get as any).mockImplementation((key: string, def?: any) => {
        if (key === 'agent.marketplace.installed') return saved;
        return def;
      });
      const mkt = new AgentMarketplace(state as any, vi.fn(), vi.fn());
      expect(mkt.listInstalled().length).toBe(1);
      expect(mkt.listInstalled()[0].id).toBe('regex-helper');
    });

    it('should load custom community agents from memento', () => {
      const state = createMockState();
      const custom: MarketplaceAgent[] = [{
        id: 'mkt-custom',
        name: 'Custom',
        description: 'Custom agent',
        author: 'test',
        version: '1.0.0',
        icon: '⚡',
        tags: ['custom'],
        downloads: 10,
        rating: 5,
        ratingCount: 1,
        publishedAt: Date.now(),
        updatedAt: Date.now(),
        pluginData: { id: 'custom', name: 'Custom' },
      }];
      (state.get as any).mockImplementation((key: string, def?: any) => {
        if (key === 'agent.marketplace.community') return custom;
        return def;
      });
      const mkt = new AgentMarketplace(state as any, vi.fn(), vi.fn());
      const found = mkt.browse().find(a => a.id === 'mkt-custom');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Custom');
    });
  });

  describe('built-in agents', () => {
    it('should include Regex Helper', () => {
      const agents = marketplace.browse();
      const regex = agents.find(a => a.id === 'mkt-regex-helper');
      expect(regex).toBeDefined();
      expect(regex!.name).toBe('Regex Helper');
    });

    it('should include SQL Wizard', () => {
      const agents = marketplace.browse();
      const sql = agents.find(a => a.id === 'mkt-sql-wizard');
      expect(sql).toBeDefined();
    });

    it('should include Color Palette Generator', () => {
      const agents = marketplace.browse();
      const color = agents.find(a => a.id === 'mkt-color-palette');
      expect(color).toBeDefined();
    });

    it('should include Commit Message Writer', () => {
      const agents = marketplace.browse();
      const commit = agents.find(a => a.id === 'mkt-commit-writer');
      expect(commit).toBeDefined();
    });

    it('should include Env Manager', () => {
      const agents = marketplace.browse();
      const env = agents.find(a => a.id === 'mkt-env-manager');
      expect(env).toBeDefined();
    });

    it('should have valid structure for all agents', () => {
      const agents = marketplace.browse();
      for (const agent of agents) {
        expect(agent.id).toBeTruthy();
        expect(agent.name).toBeTruthy();
        expect(agent.description).toBeTruthy();
        expect(agent.author).toBeTruthy();
        expect(agent.version).toBeTruthy();
        expect(agent.tags).toBeInstanceOf(Array);
        expect(agent.rating).toBeGreaterThanOrEqual(0);
        expect(agent.rating).toBeLessThanOrEqual(5);
        expect(agent.downloads).toBeGreaterThanOrEqual(0);
        expect(agent.pluginData).toBeDefined();
      }
    });
  });
});
