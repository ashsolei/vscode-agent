import { describe, it, expect, beforeEach, vi } from 'vitest';
import { lm } from 'vscode';
import { ModelSelector, ModelMap } from './model-selector';

/** Helper: create a mock LanguageModelChat object */
function mockModel(family: string, id?: string): any {
  return {
    id: id ?? `${family}-model`,
    family,
    name: `${family} Model`,
    vendor: 'test-vendor',
    version: '1.0',
    maxInputTokens: 128_000,
    countTokens: vi.fn().mockResolvedValue(10),
    sendRequest: vi.fn().mockResolvedValue({ text: vi.fn() }),
  };
}

describe('ModelSelector', () => {
  let selector: ModelSelector;

  beforeEach(() => {
    vi.mocked(lm.selectChatModels).mockReset();
    vi.mocked(lm.selectChatModels).mockResolvedValue([]);
    selector = new ModelSelector();
  });

  // ─── 1. Constructor with default config ─────────────────

  describe('constructor — default config', () => {
    it('should use copilot as default family', () => {
      const config = selector.getConfig();
      expect(config.default).toEqual({ family: 'copilot' });
    });

    it('should initialise with empty agents map', () => {
      const config = selector.getConfig();
      expect(config.agents).toEqual({});
    });

    it('should initialise with empty categories map', () => {
      const config = selector.getConfig();
      expect(config.categories).toEqual({});
    });
  });

  // ─── 2. Constructor with custom config ──────────────────

  describe('constructor — custom config', () => {
    it('should accept a custom default model', () => {
      const sel = new ModelSelector({ default: { family: 'gpt-4o', maxTokens: 4096 } });
      const config = sel.getConfig();
      expect(config.default).toEqual({ family: 'gpt-4o', maxTokens: 4096 });
    });

    it('should accept agent-specific models', () => {
      const sel = new ModelSelector({
        agents: { code: { family: 'claude', version: '3.5' } },
      });
      expect(sel.getConfig().agents).toEqual({ code: { family: 'claude', version: '3.5' } });
    });

    it('should accept category-specific models', () => {
      const sel = new ModelSelector({
        categories: { autonomous: { family: 'gpt-4o', temperature: 0.2 } },
      });
      expect(sel.getConfig().categories).toEqual({
        autonomous: { family: 'gpt-4o', temperature: 0.2 },
      });
    });

    it('should use copilot as default when only partial config given', () => {
      const sel = new ModelSelector({ agents: { code: { family: 'claude' } } });
      expect(sel.getConfig().default).toEqual({ family: 'copilot' });
    });
  });

  // ─── 3. updateConfig() ─────────────────────────────────

  describe('updateConfig()', () => {
    it('should update the default model', () => {
      selector.updateConfig({ default: { family: 'gpt-4o' } });
      expect(selector.getConfig().default).toEqual({ family: 'gpt-4o' });
    });

    it('should merge agent-specific models', () => {
      selector.updateConfig({ agents: { code: { family: 'claude' } } });
      selector.updateConfig({ agents: { docs: { family: 'gpt-4o' } } });
      const agents = selector.getConfig().agents!;
      expect(agents.code).toEqual({ family: 'claude' });
      expect(agents.docs).toEqual({ family: 'gpt-4o' });
    });

    it('should merge category-specific models', () => {
      selector.updateConfig({ categories: { autonomous: { family: 'claude' } } });
      selector.updateConfig({ categories: { analysis: { family: 'gpt-4o' } } });
      const cats = selector.getConfig().categories!;
      expect(cats.autonomous).toEqual({ family: 'claude' });
      expect(cats.analysis).toEqual({ family: 'gpt-4o' });
    });

    it('should override existing agent config on merge', () => {
      selector.updateConfig({ agents: { code: { family: 'claude' } } });
      selector.updateConfig({ agents: { code: { family: 'gpt-4o' } } });
      expect(selector.getConfig().agents!.code).toEqual({ family: 'gpt-4o' });
    });

    it('should not change categories when only agents are updated', () => {
      selector.updateConfig({ categories: { basic: { family: 'claude' } } });
      selector.updateConfig({ agents: { code: { family: 'gpt-4o' } } });
      expect(selector.getConfig().categories!.basic).toEqual({ family: 'claude' });
    });
  });

  // ─── 4. selectModel() — priority chain ─────────────────

  describe('selectModel()', () => {
    const fallbackModel = mockModel('copilot', 'request-fallback');

    it('should return request model when default is copilot and no overrides', async () => {
      const result = await selector.selectModel('code', fallbackModel);
      expect(result).toBe(fallbackModel);
    });

    it('should prefer agent-specific model over everything', async () => {
      const agentModel = mockModel('claude');
      vi.mocked(lm.selectChatModels).mockResolvedValue([agentModel]);

      selector.updateConfig({ agents: { code: { family: 'claude' } } });
      const result = await selector.selectModel('code', fallbackModel);
      expect(result).toBe(agentModel);
    });

    it('should use category model when no agent-specific model exists', async () => {
      const catModel = mockModel('gpt-4o');
      vi.mocked(lm.selectChatModels).mockResolvedValue([catModel]);

      // 'code' maps to 'basic' category
      selector.updateConfig({ categories: { basic: { family: 'gpt-4o' } } });
      const result = await selector.selectModel('code', fallbackModel);
      expect(result).toBe(catModel);
    });

    it('should use default model when no agent or category model exists', async () => {
      const defaultModel = mockModel('gpt-4o');
      vi.mocked(lm.selectChatModels).mockResolvedValue([defaultModel]);

      selector.updateConfig({ default: { family: 'gpt-4o' } });
      const result = await selector.selectModel('code', fallbackModel);
      expect(result).toBe(defaultModel);
    });

    it('should fall back to request model when configured model is not found', async () => {
      vi.mocked(lm.selectChatModels).mockResolvedValue([]);
      selector.updateConfig({
        default: { family: 'nonexistent-model' },
        agents: { code: { family: 'also-nonexistent' } },
      });
      const result = await selector.selectModel('code', fallbackModel);
      expect(result).toBe(fallbackModel);
    });

    it('should fall back to request model when selectChatModels throws', async () => {
      vi.mocked(lm.selectChatModels).mockRejectedValue(new Error('API unavailable'));
      selector.updateConfig({ agents: { code: { family: 'claude' } } });
      const result = await selector.selectModel('code', fallbackModel);
      expect(result).toBe(fallbackModel);
    });

    it('should skip category lookup for unmapped agent IDs', async () => {
      const defaultModel = mockModel('gpt-4o');
      vi.mocked(lm.selectChatModels).mockResolvedValue([defaultModel]);

      selector.updateConfig({ default: { family: 'gpt-4o' } });
      // 'unknown-agent' is not in CATEGORY_MAP, should skip to default
      const result = await selector.selectModel('unknown-agent', fallbackModel);
      expect(result).toBe(defaultModel);
    });

    it('should cache model lookups', async () => {
      const agentModel = mockModel('claude');
      vi.mocked(lm.selectChatModels).mockResolvedValue([agentModel]);

      selector.updateConfig({ agents: { code: { family: 'claude' } } });
      await selector.selectModel('code', fallbackModel);
      await selector.selectModel('code', fallbackModel);

      // First call goes through, second hits cache, so selectChatModels called once
      expect(lm.selectChatModels).toHaveBeenCalledTimes(1);
    });

    it('agent-specific model wins over category model', async () => {
      const agentModel = mockModel('claude', 'agent-specific');
      const catModel = mockModel('gpt-4o', 'category-model');

      // Return the right model based on the selector argument
      vi.mocked(lm.selectChatModels).mockImplementation(async (sel?: any) => {
        if (sel?.family === 'claude') return [agentModel];
        if (sel?.family === 'gpt-4o') return [catModel];
        return [];
      });

      selector.updateConfig({
        agents: { code: { family: 'claude' } },
        categories: { basic: { family: 'gpt-4o' } },
      });

      const result = await selector.selectModel('code', fallbackModel);
      expect(result.id).toBe('agent-specific');
    });

    it('category model wins over default model', async () => {
      const catModel = mockModel('claude', 'cat-model');
      const defModel = mockModel('gpt-4o', 'default-model');

      vi.mocked(lm.selectChatModels).mockImplementation(async (sel?: any) => {
        if (sel?.family === 'claude') return [catModel];
        if (sel?.family === 'gpt-4o') return [defModel];
        return [];
      });

      selector.updateConfig({
        default: { family: 'gpt-4o' },
        categories: { basic: { family: 'claude' } },
      });

      const result = await selector.selectModel('code', fallbackModel);
      expect(result.id).toBe('cat-model');
    });

    it('should pass version to selector when specified', async () => {
      vi.mocked(lm.selectChatModels).mockResolvedValue([mockModel('claude')]);
      selector.updateConfig({
        agents: { code: { family: 'claude', version: '3.5-sonnet' } },
      });

      await selector.selectModel('code', fallbackModel);
      expect(lm.selectChatModels).toHaveBeenCalledWith(
        expect.objectContaining({ family: 'claude', version: '3.5-sonnet' }),
      );
    });
  });

  // ─── 5. getModelOptions() ──────────────────────────────

  describe('getModelOptions()', () => {
    it('should return empty options when default has no maxTokens', () => {
      const options = selector.getModelOptions('code');
      expect(options).toEqual({});
    });

    it('should return maxTokens from agent-specific config', () => {
      selector.updateConfig({ agents: { code: { family: 'claude', maxTokens: 8192 } } });
      const options = selector.getModelOptions('code') as any;
      expect(options.maxTokens).toBe(8192);
    });

    it('should fall back to category config when no agent config', () => {
      selector.updateConfig({
        categories: { basic: { family: 'gpt-4o', maxTokens: 4096 } },
      });
      // 'code' is in 'basic' category
      const options = selector.getModelOptions('code') as any;
      expect(options.maxTokens).toBe(4096);
    });

    it('should fall back to default config when no agent or category config', () => {
      selector.updateConfig({ default: { family: 'gpt-4o', maxTokens: 2048 } });
      const options = selector.getModelOptions('code') as any;
      expect(options.maxTokens).toBe(2048);
    });

    it('should prefer agent config over category config', () => {
      selector.updateConfig({
        agents: { code: { family: 'claude', maxTokens: 8000 } },
        categories: { basic: { family: 'gpt-4o', maxTokens: 4000 } },
      });
      const options = selector.getModelOptions('code') as any;
      expect(options.maxTokens).toBe(8000);
    });

    it('should use default for agents not in any category', () => {
      selector.updateConfig({ default: { family: 'gpt-4o', maxTokens: 1024 } });
      const options = selector.getModelOptions('unknown-agent') as any;
      expect(options.maxTokens).toBe(1024);
    });
  });

  // ─── 6. describeModelAssignments() ─────────────────────

  describe('describeModelAssignments()', () => {
    it('should always include the header and default model', () => {
      const output = selector.describeModelAssignments();
      expect(output).toContain('## Modell-konfiguration');
      expect(output).toContain('**Default:** copilot');
    });

    it('should include per-agent section when agents are configured', () => {
      selector.updateConfig({
        agents: { code: { family: 'claude', version: '3.5' } },
      });
      const output = selector.describeModelAssignments();
      expect(output).toContain('### Per agent:');
      expect(output).toContain('`code`: claude (3.5)');
    });

    it('should include per-category section when categories are configured', () => {
      selector.updateConfig({
        categories: { autonomous: { family: 'gpt-4o' } },
      });
      const output = selector.describeModelAssignments();
      expect(output).toContain('### Per kategori:');
      expect(output).toContain('`autonomous`: gpt-4o');
    });

    it('should omit version parenthetical when version is not set', () => {
      selector.updateConfig({ agents: { code: { family: 'claude' } } });
      const output = selector.describeModelAssignments();
      expect(output).toContain('`code`: claude');
      expect(output).not.toContain('(undefined)');
    });

    it('should omit agent section when no agents configured', () => {
      const output = selector.describeModelAssignments();
      expect(output).not.toContain('### Per agent:');
    });

    it('should omit category section when no categories configured', () => {
      const output = selector.describeModelAssignments();
      expect(output).not.toContain('### Per kategori:');
    });

    it('should list multiple agents', () => {
      selector.updateConfig({
        agents: {
          code: { family: 'claude' },
          docs: { family: 'gpt-4o', version: 'turbo' },
        },
      });
      const output = selector.describeModelAssignments();
      expect(output).toContain('`code`: claude');
      expect(output).toContain('`docs`: gpt-4o (turbo)');
    });
  });

  // ─── 7. getConfig() ────────────────────────────────────

  describe('getConfig()', () => {
    it('should return a copy of the config', () => {
      const config1 = selector.getConfig();
      const config2 = selector.getConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // different object references
    });

    it('should reflect updates after updateConfig()', () => {
      selector.updateConfig({ default: { family: 'gpt-4o' } });
      expect(selector.getConfig().default.family).toBe('gpt-4o');
    });
  });

  // ─── 8. dispose() ──────────────────────────────────────

  describe('dispose()', () => {
    it('should dispose without errors', () => {
      expect(() => selector.dispose()).not.toThrow();
    });

    it('should dispose all registered disposables', () => {
      // Access internals to add a disposable
      const disposeFn = vi.fn();
      (selector as any).disposables.push({ dispose: disposeFn });
      selector.dispose();
      expect(disposeFn).toHaveBeenCalledOnce();
    });
  });

  // ─── 9. CATEGORY_MAP ──────────────────────────────────

  describe('CATEGORY_MAP', () => {
    // Access the private static via any cast
    const categoryMap: Record<string, string> = (ModelSelector as any).CATEGORY_MAP;

    it('should be defined', () => {
      expect(categoryMap).toBeDefined();
      expect(typeof categoryMap).toBe('object');
    });

    const expectedMappings: Record<string, string> = {
      // basic
      code: 'basic', docs: 'basic', task: 'basic', status: 'basic',
      // analysis
      review: 'analysis', security: 'analysis', perf: 'analysis', debug: 'analysis',
      // architecture
      architect: 'architecture', api: 'architecture',
      // autonomous
      scaffold: 'autonomous', autofix: 'autonomous', devops: 'autonomous',
      db: 'autonomous', migrate: 'autonomous', component: 'autonomous',
      i18n: 'autonomous', plan: 'autonomous', a11y: 'autonomous',
      docgen: 'autonomous', metrics: 'autonomous', cli: 'autonomous',
      fullstack: 'autonomous',
      // transform
      refactor: 'transform', translate: 'transform',
      // other
      test: 'testing', explain: 'education', deps: 'dependencies', git: 'git',
    };

    it.each(Object.entries(expectedMappings))(
      'should map "%s" to category "%s"',
      (agentId, expectedCategory) => {
        expect(categoryMap[agentId]).toBe(expectedCategory);
      },
    );

    it('should have all expected agent IDs', () => {
      const expectedIds = Object.keys(expectedMappings).sort();
      const actualIds = Object.keys(categoryMap).sort();
      expect(actualIds).toEqual(expectedIds);
    });

    it('should contain known category names', () => {
      const categories = new Set(Object.values(categoryMap));
      expect(categories).toContain('basic');
      expect(categories).toContain('analysis');
      expect(categories).toContain('architecture');
      expect(categories).toContain('autonomous');
      expect(categories).toContain('transform');
      expect(categories).toContain('testing');
      expect(categories).toContain('education');
      expect(categories).toContain('dependencies');
      expect(categories).toContain('git');
    });
  });

  // ─── 10. Cache invalidation on config change ──────────

  describe('cache invalidation on config change', () => {
    const fallbackModel = mockModel('copilot', 'fallback');

    it('should clear model cache when config is updated', async () => {
      const claudeModel = mockModel('claude');
      vi.mocked(lm.selectChatModels).mockResolvedValue([claudeModel]);

      selector.updateConfig({ agents: { code: { family: 'claude' } } });
      await selector.selectModel('code', fallbackModel);

      // Now selectChatModels was called once and result cached
      expect(lm.selectChatModels).toHaveBeenCalledTimes(1);

      // Update config — cache should be cleared
      const gptModel = mockModel('gpt-4o');
      vi.mocked(lm.selectChatModels).mockResolvedValue([gptModel]);
      selector.updateConfig({ agents: { code: { family: 'gpt-4o' } } });

      await selector.selectModel('code', fallbackModel);
      // Should have called selectChatModels again because cache was cleared
      expect(lm.selectChatModels).toHaveBeenCalledTimes(2);
    });

    it('should clear all cached models, not just the updated agent', async () => {
      const model = mockModel('claude');
      vi.mocked(lm.selectChatModels).mockResolvedValue([model]);

      selector.updateConfig({
        agents: {
          code: { family: 'claude' },
          docs: { family: 'claude' },
        },
      });

      await selector.selectModel('code', fallbackModel);
      await selector.selectModel('docs', fallbackModel);
      // Both use same cache key 'claude:latest', so 1 call total
      expect(lm.selectChatModels).toHaveBeenCalledTimes(1);

      // Updating only one agent still clears full cache
      selector.updateConfig({ agents: { code: { family: 'gpt-4o' } } });

      vi.mocked(lm.selectChatModels).mockResolvedValue([mockModel('claude')]);
      await selector.selectModel('docs', fallbackModel);
      // Cache was cleared, so it has to look up again
      expect(lm.selectChatModels).toHaveBeenCalledTimes(2);
    });

    it('should use freshly cached model after config update', async () => {
      const oldModel = mockModel('claude', 'old-claude');
      vi.mocked(lm.selectChatModels).mockResolvedValue([oldModel]);

      selector.updateConfig({ agents: { code: { family: 'claude' } } });
      const r1 = await selector.selectModel('code', fallbackModel);
      expect(r1.id).toBe('old-claude');

      // Simulate a new model becoming available
      const newModel = mockModel('claude', 'new-claude');
      vi.mocked(lm.selectChatModels).mockResolvedValue([newModel]);

      // Update triggers cache clear
      selector.updateConfig({ default: { family: 'copilot' } });
      const r2 = await selector.selectModel('code', fallbackModel);
      expect(r2.id).toBe('new-claude');
    });
  });

  // ─── Edge cases ────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty updateConfig gracefully', () => {
      expect(() => selector.updateConfig({})).not.toThrow();
      expect(selector.getConfig().default).toEqual({ family: 'copilot' });
    });

    it('should handle listAvailableModels', async () => {
      const models = [mockModel('claude'), mockModel('gpt-4o')];
      vi.mocked(lm.selectChatModels).mockResolvedValue(models);

      const result = await selector.listAvailableModels();
      expect(result).toHaveLength(2);
      expect(lm.selectChatModels).toHaveBeenCalledWith();
    });
  });
});
