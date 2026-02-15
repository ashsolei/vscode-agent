import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentCodeLensProvider } from './agent-codelens';

describe('AgentCodeLensProvider', () => {
  let provider: AgentCodeLensProvider;

  const createMockDocument = (text: string) => ({
    getText: () => text,
    lineCount: text.split('\n').length,
    languageId: 'typescript',
  });

  const mockToken = { isCancellationRequested: false };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AgentCodeLensProvider();
  });

  describe('isEnabled / setEnabled', () => {
    it('should be enabled by default', () => {
      expect(provider.isEnabled()).toBe(true);
    });

    it('should toggle enabled state', () => {
      provider.setEnabled(false);
      expect(provider.isEnabled()).toBe(false);
      provider.setEnabled(true);
      expect(provider.isEnabled()).toBe(true);
    });

    it('should fire onDidChangeCodeLenses when toggled', () => {
      const listener = vi.fn();
      provider.onDidChangeCodeLenses(listener);
      provider.setEnabled(false);
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('provideCodeLenses', () => {
    it('should return empty array when disabled', () => {
      provider.setEnabled(false);
      const doc = createMockDocument('function test() {}');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      expect(lenses).toEqual([]);
    });

    it('should return empty array for empty document', () => {
      const doc = createMockDocument('');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      expect(lenses).toEqual([]);
    });

    it('should detect TODO comments', () => {
      const doc = createMockDocument('// TODO: fix this bug');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const todoLens = lenses.find(l => l.command?.title.includes('Fixa'));
      expect(todoLens).toBeDefined();
    });

    it('should detect FIXME comments', () => {
      const doc = createMockDocument('// FIXME: broken logic');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const fixmeLens = lenses.find(l => l.command?.title.includes('Fixa'));
      expect(fixmeLens).toBeDefined();
    });

    it('should detect HACK comments', () => {
      const doc = createMockDocument('// HACK: temporary workaround');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const hackLens = lenses.find(l => l.command?.title.includes('Fixa'));
      expect(hackLens).toBeDefined();
    });

    it('should detect XXX comments', () => {
      const doc = createMockDocument('// XXX: needs review');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const xxxLens = lenses.find(l => l.command?.title.includes('Fixa'));
      expect(xxxLens).toBeDefined();
    });

    it('should detect BUG comments', () => {
      const doc = createMockDocument('// BUG: race condition');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const bugLens = lenses.find(l => l.command?.title.includes('Fixa'));
      expect(bugLens).toBeDefined();
    });

    it('should detect undocumented functions', () => {
      const doc = createMockDocument('some other code\nexport function myFunction() {');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const docLens = lenses.find(l => l.command?.title.includes('Dokumentera'));
      expect(docLens).toBeDefined();
    });

    it('should NOT add doc lens for documented functions', () => {
      const doc = createMockDocument('/** JSDoc comment */\nexport function myFunction() {');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const docLens = lenses.find(l => l.command?.title === '📝 Dokumentera');
      expect(docLens).toBeUndefined();
    });

    it('should NOT add doc lens for private functions', () => {
      const doc = createMockDocument('some other code\n_privateFunction() {');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const docLens = lenses.find(l => l.command?.title === '📝 Dokumentera');
      expect(docLens).toBeUndefined();
    });

    it('should detect exported classes and offer test generation', () => {
      const doc = createMockDocument('export class MyService {');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const testLens = lenses.find(l => l.command?.title.includes('Generera tester'));
      expect(testLens).toBeDefined();
    });

    it('should detect export default class', () => {
      const doc = createMockDocument('export default class MyComponent {');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const testLens = lenses.find(l => l.command?.title.includes('Generera tester'));
      expect(testLens).toBeDefined();
    });

    it('should detect large functions (>50 lines)', () => {
      const lines = ['export function bigFunction() {'];
      for (let i = 0; i < 55; i++) {
        lines.push(`  const x${i} = ${i};`);
      }
      lines.push('}');
      const doc = createMockDocument(lines.join('\n'));
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const refactorLens = lenses.find(l => l.command?.title.includes('Refaktorera'));
      expect(refactorLens).toBeDefined();
    });

    it('should NOT flag small functions for refactoring', () => {
      const doc = createMockDocument('export function small() {\n  return 1;\n}');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      const refactorLens = lenses.find(l => l.command?.title.includes('Refaktorera'));
      expect(refactorLens).toBeUndefined();
    });

    it('should handle multiple code lens types in one document', () => {
      const code = [
        '// TODO: fix this',
        'some other code',
        'export function undocumented() {',
        '  return 1;',
        '}',
        'export class MyClass {',
        '}',
      ].join('\n');
      const doc = createMockDocument(code);
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      expect(lenses.length).toBeGreaterThanOrEqual(2);
    });

    it('should use correct commands for lenses', () => {
      const doc = createMockDocument('// TODO: fix this');
      const lenses = provider.provideCodeLenses(doc as any, mockToken as any);
      for (const lens of lenses) {
        expect(lens.command?.command).toBe('workbench.action.chat.open');
        expect(lens.command?.arguments).toBeDefined();
      }
    });
  });
});
