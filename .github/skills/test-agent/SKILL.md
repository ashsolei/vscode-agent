---
name: "Test Agent"
description: "Write comprehensive Vitest tests for agents — covering handle(), edge cases, cancellation, error handling, and mock patterns"
argument-hint: "Which agent or module to test? e.g. 'SecurityAgent' or 'src/cache/response-cache.ts'"
---

# Test Agent Skill

Write Vitest tests for the VS Code Agent extension, following established patterns.

## Test Environment

- **Runner**: Vitest 2.0+ with `node` environment
- **Config**: `vitest.config.ts` at project root
- **Mock**: `src/__mocks__/vscode.ts` provides the VS Code API mock
- **Pattern**: Tests co-located with source: `src/<module>/<name>.test.ts`

## VS Code Mock (`src/__mocks__/vscode.ts`)

The mock provides:
```typescript
// Available mock objects:
vscode.Uri.file(path)          // creates URI
vscode.Uri.parse(uri)          // parses URI string
vscode.workspace.workspaceFolders  // mock folders array
vscode.workspace.getConfiguration() // returns mock config
vscode.workspace.findFiles()   // returns Promise<Uri[]>
vscode.window.showInformationMessage()
vscode.window.showErrorMessage()
vscode.languages.getDiagnostics()
vscode.lm.selectChatModels()   // returns mock model
vscode.LanguageModelChatMessage.User(content)
vscode.LanguageModelChatMessage.Assistant(content)
vscode.CancellationTokenSource
```

## Test Template for Agents

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { <Name>Agent } from './<name>-agent';

vi.mock('vscode');

describe('<Name>Agent', () => {
    let agent: <Name>Agent;
    let mockStream: any;
    let mockToken: any;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new <Name>Agent();
        mockStream = {
            markdown: vi.fn(),
            progress: vi.fn(),
            reference: vi.fn(),
            button: vi.fn(),
            anchor: vi.fn(),
        };
        mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: vi.fn(),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Identity tests
    it('should have correct id', () => {
        expect(agent.id).toBe('<name>');
    });

    it('should have a non-empty description', () => {
        expect(agent.description).toBeTruthy();
        expect(typeof agent.description).toBe('string');
    });

    // Cancellation test
    it('should return early on cancellation', async () => {
        mockToken.isCancellationRequested = true;
        const ctx = {
            request: { prompt: 'test' },
            chatContext: { history: [] },
            stream: mockStream,
            token: mockToken,
        };
        const result = await agent.handle(ctx as any);
        expect(mockStream.markdown).not.toHaveBeenCalled();
    });

    // Happy path
    it('should stream response for valid input', async () => {
        const ctx = {
            request: { prompt: 'do something', command: '<name>' },
            chatContext: { history: [] },
            stream: mockStream,
            token: mockToken,
        };
        const result = await agent.handle(ctx as any);
        expect(result).toBeDefined();
    });

    // Error handling
    it('should handle missing language model gracefully', async () => {
        const vscode = await import('vscode');
        vi.mocked(vscode.lm.selectChatModels).mockResolvedValueOnce([]);
        
        const ctx = {
            request: { prompt: 'test' },
            chatContext: { history: [] },
            stream: mockStream,
            token: mockToken,
        };
        const result = await agent.handle(ctx as any);
        expect(result).toBeDefined();
    });
});
```

## Test Template for Modules

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode');

describe('<Module>', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default configuration', () => {
            // test defaults
        });
    });

    describe('<method>', () => {
        it('should handle normal input', () => { });
        it('should handle edge cases', () => { });
        it('should throw on invalid input', () => { });
    });
});
```

## Coverage Targets

- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Run coverage: `npm run test:coverage`

## Test Categories to Cover

1. **Identity**: agent ID, description, isAutonomous flag
2. **Happy path**: normal input → expected output
3. **Cancellation**: token.isCancellationRequested = true → early return
4. **Error handling**: missing model, API errors, invalid input
5. **Edge cases**: empty prompt, very long input, special characters
6. **Workspace context**: with and without workspaceContext injection
7. **Follow-ups**: verify returned followUps structure

## Commands

```bash
npm test                    # run all tests
npm run test:watch          # watch mode
npm run test:coverage       # with v8 coverage
npx vitest run src/agents/<name>.test.ts  # single file
```
