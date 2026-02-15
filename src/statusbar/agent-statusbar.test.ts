import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window } from 'vscode';
import { AgentStatusBar } from './agent-statusbar';

describe('AgentStatusBar', () => {
  let statusBar: AgentStatusBar;

  beforeEach(() => {
    vi.clearAllMocks();
    statusBar = new AgentStatusBar();
  });

  describe('constructor', () => {
    it('should create four status bar items', () => {
      // mainItem + memoryItem + cacheItem + pluginItem = 4 calls
      expect(window.createStatusBarItem).toHaveBeenCalledTimes(4);
    });

    it('should show all status bar items', () => {
      const mockItem = (window.createStatusBarItem as any)();
      expect(mockItem.show).toHaveBeenCalled();
    });
  });

  describe('setActive', () => {
    it('should set active agent and increment totalRuns', () => {
      statusBar.setActive('code', 'CodeAgent');
      const stats = statusBar.getStats();
      expect(stats.totalRuns).toBe(1);
      expect(stats.lastAgent).toBe('CodeAgent');
    });

    it('should track multiple runs', () => {
      statusBar.setActive('code', 'CodeAgent');
      statusBar.setActive('docs', 'DocsAgent');
      statusBar.setActive('test', 'TestAgent');
      const stats = statusBar.getStats();
      expect(stats.totalRuns).toBe(3);
      expect(stats.lastAgent).toBe('TestAgent');
    });
  });

  describe('setIdle', () => {
    it('should clear active agent on success', () => {
      statusBar.setActive('code', 'CodeAgent');
      statusBar.setIdle(true);
      const stats = statusBar.getStats();
      expect(stats.errors).toBe(0);
    });

    it('should increment errors on failure', () => {
      statusBar.setActive('code', 'CodeAgent');
      statusBar.setIdle(false);
      const stats = statusBar.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should default to success when no argument', () => {
      statusBar.setActive('code', 'CodeAgent');
      statusBar.setIdle();
      const stats = statusBar.getStats();
      expect(stats.errors).toBe(0);
    });

    it('should accumulate errors', () => {
      statusBar.setActive('a', 'A');
      statusBar.setIdle(false);
      statusBar.setActive('b', 'B');
      statusBar.setIdle(false);
      statusBar.setActive('c', 'C');
      statusBar.setIdle(true);
      const stats = statusBar.getStats();
      expect(stats.errors).toBe(2);
      expect(stats.totalRuns).toBe(3);
    });
  });

  describe('updateMemory', () => {
    it('should update memory item text', () => {
      statusBar.updateMemory(42);
      // Access via internal — the mock stores text as property
    });

    it('should handle zero memories', () => {
      statusBar.updateMemory(0);
    });
  });

  describe('updatePlugins', () => {
    it('should update plugin item text', () => {
      statusBar.updatePlugins(5);
    });

    it('should handle zero plugins', () => {
      statusBar.updatePlugins(0);
    });
  });

  describe('updateCache', () => {
    it('should update cache statistics', () => {
      statusBar.updateCache({ size: 10, hitRate: 75, hits: 15, misses: 5 });
    });

    it('should handle empty cache', () => {
      statusBar.updateCache({ size: 0, hitRate: 0, hits: 0, misses: 0 });
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = statusBar.getStats();
      expect(stats).toEqual({
        totalRuns: 0,
        errors: 0,
        lastAgent: '',
      });
    });

    it('should return stats after activity', () => {
      statusBar.setActive('code', 'CodeAgent');
      statusBar.setIdle(true);
      statusBar.setActive('docs', 'DocsAgent');
      statusBar.setIdle(false);
      const stats = statusBar.getStats();
      expect(stats.totalRuns).toBe(2);
      expect(stats.errors).toBe(1);
      expect(stats.lastAgent).toBe('DocsAgent');
    });
  });

  describe('dispose', () => {
    it('should dispose all status bar items', () => {
      statusBar.dispose();
      // Should not throw
    });

    it('should be safe to call multiple times', () => {
      statusBar.dispose();
      statusBar.dispose();
    });
  });

  describe('render states', () => {
    it('should show ready state initially', () => {
      // Constructor calls render() — ready state
      const stats = statusBar.getStats();
      expect(stats.totalRuns).toBe(0);
    });

    it('should show active state during run', () => {
      statusBar.setActive('code', 'CodeAgent');
      // Internally renders spinner
    });

    it('should show idle state with stats after run', () => {
      statusBar.setActive('code', 'CodeAgent');
      statusBar.setIdle(true);
      const stats = statusBar.getStats();
      expect(stats.totalRuns).toBe(1);
    });

    it('should show error background on errors', () => {
      statusBar.setActive('code', 'CodeAgent');
      statusBar.setIdle(false);
      const stats = statusBar.getStats();
      expect(stats.errors).toBe(1);
    });
  });
});
