import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTreeProvider } from './agent-tree';
import { AgentRegistry } from '../agents/index';
import { BaseAgent } from '../agents/base-agent';

// Minimal mock agent for testing
class MockAgent extends BaseAgent {
  constructor(id: string, name: string, description: string) {
    super(id, name, description);
  }
  async handle(): Promise<any> {
    return {};
  }
}

describe('AgentTreeProvider', () => {
  let provider: AgentTreeProvider;
  let registry: AgentRegistry;
  let mockState: Record<string, any>;

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
    registry = new AgentRegistry();
    provider = new AgentTreeProvider(registry, createMockState() as any);
  });

  describe('getChildren (root)', () => {
    it('should return empty when no agents registered', () => {
      const children = provider.getChildren();
      expect(children).toEqual([]);
    });

    it('should return categories when agents are registered', () => {
      registry.register(new MockAgent('code', 'Code', 'Code analysis'));
      const children = provider.getChildren();
      expect(children.length).toBeGreaterThan(0);
    });

    it('should group agents into categories', () => {
      registry.register(new MockAgent('code', 'Code', 'Code analysis'));
      registry.register(new MockAgent('docs', 'Docs', 'Documentation'));
      registry.register(new MockAgent('refactor', 'Refactor', 'Refactoring'));
      const categories = provider.getChildren();
      expect(categories.length).toBeGreaterThanOrEqual(2);
    });

    it('should use usage stats from globalState', () => {
      mockState['agentUsageStats'] = { code: 42, docs: 10 };
      registry.register(new MockAgent('code', 'Code', 'Code analysis'));
      const categories = provider.getChildren();
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('getChildren (category)', () => {
    it('should return agents for a category', () => {
      registry.register(new MockAgent('code', 'Code', 'Code analysis'));
      registry.register(new MockAgent('docs', 'Docs', 'Documentation'));
      const categories = provider.getChildren();
      const category = categories[0];
      const agents = provider.getChildren(category);
      expect(agents.length).toBeGreaterThan(0);
    });
  });

  describe('getTreeItem', () => {
    it('should return the element itself', () => {
      registry.register(new MockAgent('code', 'Code', 'Code analysis'));
      const categories = provider.getChildren();
      const item = provider.getTreeItem(categories[0]);
      expect(item).toBe(categories[0]);
    });
  });

  describe('refresh', () => {
    it('should fire onDidChangeTreeData', () => {
      const listener = vi.fn();
      provider.onDidChangeTreeData(listener);
      provider.refresh();
      expect(listener).toHaveBeenCalledWith(undefined);
    });
  });

  describe('agent categories', () => {
    it('should categorize code agent as Grundläggande', () => {
      registry.register(new MockAgent('code', 'Code', 'Code analysis'));
      const categories = provider.getChildren();
      const grundlaggande = categories.find((c: any) => c.label === 'Grundläggande');
      expect(grundlaggande).toBeDefined();
    });

    it('should categorize security agent as Prestanda & Säkerhet', () => {
      registry.register(new MockAgent('security', 'Security', 'Security scanning'));
      const categories = provider.getChildren();
      const security = categories.find((c: any) => c.label === 'Prestanda & Säkerhet');
      expect(security).toBeDefined();
    });

    it('should categorize scaffold agent as Autonoma', () => {
      registry.register(new MockAgent('scaffold', 'Scaffold', 'Project scaffolding'));
      const categories = provider.getChildren();
      const autonoma = categories.find((c: any) => c.label === 'Autonoma');
      expect(autonoma).toBeDefined();
    });

    it('should categorize testrunner as Testning', () => {
      registry.register(new MockAgent('testrunner', 'TestRunner', 'Test execution'));
      const categories = provider.getChildren();
      const testning = categories.find((c: any) => c.label === 'Testning');
      expect(testning).toBeDefined();
    });

    it('should categorize create-agent as Meta', () => {
      registry.register(new MockAgent('create-agent', 'CreateAgent', 'Agent creation'));
      const categories = provider.getChildren();
      const meta = categories.find((c: any) => c.label === 'Meta');
      expect(meta).toBeDefined();
    });
  });

  describe('agent tree items', () => {
    it('should include usage count in description', () => {
      mockState['agentUsageStats'] = { code: 15 };
      registry.register(new MockAgent('code', 'Code', 'Code analysis'));
      const categories = provider.getChildren();
      const agents = provider.getChildren(categories[0]);
      expect((agents[0] as any).description).toContain('15');
    });

    it('should set click command to open chat', () => {
      registry.register(new MockAgent('code', 'Code', 'Code analysis'));
      const categories = provider.getChildren();
      const agents = provider.getChildren(categories[0]);
      expect((agents[0] as any).command?.command).toBe('workbench.action.chat.open');
    });

    it('should have a tooltip with agent info', () => {
      registry.register(new MockAgent('code', 'Code', 'Code analysis'));
      const categories = provider.getChildren();
      const agents = provider.getChildren(categories[0]);
      expect((agents[0] as any).tooltip).toBeDefined();
    });
  });
});
