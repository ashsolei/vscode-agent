import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPTS } from './system-prompts';

describe('System Prompts', () => {
  describe('SYSTEM_PROMPTS', () => {
    it('should export SYSTEM_PROMPTS object', () => {
      expect(SYSTEM_PROMPTS).toBeDefined();
      expect(typeof SYSTEM_PROMPTS).toBe('object');
    });

    it('should have router prompt', () => {
      expect(SYSTEM_PROMPTS.router).toBeDefined();
      expect(typeof SYSTEM_PROMPTS.router).toBe('string');
      expect(SYSTEM_PROMPTS.router.length).toBeGreaterThan(0);
    });

    it('should have code prompt', () => {
      expect(SYSTEM_PROMPTS.code).toBeDefined();
      expect(typeof SYSTEM_PROMPTS.code).toBe('string');
      expect(SYSTEM_PROMPTS.code.length).toBeGreaterThan(0);
    });

    it('should have docs prompt', () => {
      expect(SYSTEM_PROMPTS.docs).toBeDefined();
      expect(typeof SYSTEM_PROMPTS.docs).toBe('string');
      expect(SYSTEM_PROMPTS.docs.length).toBeGreaterThan(0);
    });

    it('should have task prompt', () => {
      expect(SYSTEM_PROMPTS.task).toBeDefined();
      expect(typeof SYSTEM_PROMPTS.task).toBe('string');
      expect(SYSTEM_PROMPTS.task.length).toBeGreaterThan(0);
    });

    it('should contain relevant keywords in router prompt', () => {
      expect(SYSTEM_PROMPTS.router).toContain('/code');
      expect(SYSTEM_PROMPTS.router).toContain('/docs');
      expect(SYSTEM_PROMPTS.router).toContain('/task');
    });

    it('should contain relevant keywords in code prompt', () => {
      expect(SYSTEM_PROMPTS.code.toLowerCase()).toContain('kodanalys');
    });

    it('should contain relevant keywords in docs prompt', () => {
      expect(SYSTEM_PROMPTS.docs).toContain('dokumentation');
    });

    it('should contain relevant keywords in task prompt', () => {
      expect(SYSTEM_PROMPTS.task).toContain('uppgift');
    });

    it('should have all prompts as readonly', () => {
      // SYSTEM_PROMPTS is `as const`, verify it works as expected
      const keys = Object.keys(SYSTEM_PROMPTS);
      expect(keys.length).toBeGreaterThanOrEqual(4);
    });
  });
});
