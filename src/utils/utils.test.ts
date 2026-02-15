import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTurnText, buildHistory } from './history';
import { streamResponse, sendChatRequest } from './streaming';
import { ChatResponseTurn, LanguageModelChatMessage } from 'vscode';

describe('history utils', () => {
  describe('extractTurnText', () => {
    it('should extract text from markdown parts', () => {
      const turn = {
        response: [
          { value: { value: 'Hello ' } },
          { value: { value: 'World' } },
        ],
      };
      expect(extractTurnText(turn as any)).toBe('Hello World');
    });

    it('should handle empty response', () => {
      const turn = { response: [] };
      expect(extractTurnText(turn as any)).toBe('');
    });

    it('should skip non-markdown parts', () => {
      const turn = {
        response: [
          { value: { value: 'text' } },
          { someOther: 'data' },
          { value: { value: ' more' } },
        ],
      };
      expect(extractTurnText(turn as any)).toBe('text more');
    });

    it('should handle parts without value', () => {
      const turn = {
        response: [
          { value: null },
          { value: undefined },
          { value: { value: 'ok' } },
        ],
      };
      expect(extractTurnText(turn as any)).toBe('ok');
    });
  });

  describe('buildHistory', () => {
    it('should return empty array for empty history', () => {
      const context = { history: [] };
      const messages = buildHistory(context as any);
      expect(messages).toEqual([]);
    });

    it('should convert ChatRequestTurn to user message', () => {
      const context = { history: [] };
      const messages = buildHistory(context as any);
      expect(messages).toEqual([]);
    });
  });
});

describe('streaming utils', () => {
  describe('streamResponse', () => {
    it('should stream all fragments', async () => {
      const fragments = ['Hello', ' ', 'World'];
      const mockResponse = {
        text: (async function* () {
          for (const f of fragments) yield f;
        })(),
      };
      const mockStream = { markdown: vi.fn() };

      const result = await streamResponse(mockResponse as any, mockStream as any);
      expect(result).toBe('Hello World');
      expect(mockStream.markdown).toHaveBeenCalledTimes(3);
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        text: (async function* () {})(),
      };
      const mockStream = { markdown: vi.fn() };

      const result = await streamResponse(mockResponse as any, mockStream as any);
      expect(result).toBe('');
      expect(mockStream.markdown).not.toHaveBeenCalled();
    });

    it('should stop on cancellation', async () => {
      const mockResponse = {
        text: (async function* () {
          yield 'first';
          yield 'second';
          yield 'third';
        })(),
      };
      const mockStream = { markdown: vi.fn() };
      const token = { isCancellationRequested: false };

      // Cancel after first fragment
      mockStream.markdown.mockImplementation(() => {
        token.isCancellationRequested = true;
      });

      const result = await streamResponse(mockResponse as any, mockStream as any, token as any);
      expect(result).toBe('first');
      expect(mockStream.markdown).toHaveBeenCalledTimes(1);
    });

    it('should work without cancellation token', async () => {
      const mockResponse = {
        text: (async function* () {
          yield 'data';
        })(),
      };
      const mockStream = { markdown: vi.fn() };

      const result = await streamResponse(mockResponse as any, mockStream as any);
      expect(result).toBe('data');
    });
  });

  describe('sendChatRequest', () => {
    it('should send request with system prompt and history', async () => {
      const fragments = ['response'];
      const mockModel = {
        sendRequest: vi.fn().mockResolvedValue({
          text: (async function* () {
            for (const f of fragments) yield f;
          })(),
        }),
      };
      const mockStream = { markdown: vi.fn() };
      const token = { isCancellationRequested: false };

      const result = await sendChatRequest(
        mockModel as any,
        'You are helpful.',
        'Hello',
        [],
        mockStream as any,
        token as any
      );

      expect(result).toBe('response');
      expect(mockModel.sendRequest).toHaveBeenCalledOnce();

      // Verify messages structure
      const messages = mockModel.sendRequest.mock.calls[0][0];
      expect(messages.length).toBe(2); // system + user
      expect(messages[0].content).toBe('You are helpful.');
      expect(messages[1].content).toBe('Hello');
    });

    it('should include history messages', async () => {
      const mockModel = {
        sendRequest: vi.fn().mockResolvedValue({
          text: (async function* () { yield 'ok'; })(),
        }),
      };
      const mockStream = { markdown: vi.fn() };
      const token = { isCancellationRequested: false };

      const history = [
        LanguageModelChatMessage.User('previous question'),
        LanguageModelChatMessage.Assistant('previous answer'),
      ];

      await sendChatRequest(
        mockModel as any,
        'system',
        'new question',
        history,
        mockStream as any,
        token as any
      );

      const messages = mockModel.sendRequest.mock.calls[0][0];
      expect(messages.length).toBe(4); // system + 2 history + user
    });
  });
});
