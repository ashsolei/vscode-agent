import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTurnText, buildHistory } from './history';
import { streamResponse, sendChatRequest, createCaptureStream } from './streaming';
import * as vsc from 'vscode';
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
      const turn = new vsc.ChatRequestTurn('Hello agent');
      const context = {
        history: [turn],
      };
      const messages = buildHistory(context as any);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello agent');
      expect(messages[0].role).toBe('user');
    });

    it('should convert ChatResponseTurn to assistant message', () => {
      const turn = new vsc.ChatResponseTurn('agent');
      (turn as any).response = [{ value: { value: 'I can help' } }];
      const context = { history: [turn] };
      const messages = buildHistory(context as any);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('I can help');
      expect(messages[0].role).toBe('assistant');
    });

    it('should handle mixed request and response turns', () => {
      const responseTurn = new vsc.ChatResponseTurn('agent');
      (responseTurn as any).response = [{ value: { value: 'Answer' } }];
      const context = {
        history: [
          new vsc.ChatRequestTurn('Question'),
          responseTurn,
        ],
      };
      const messages = buildHistory(context as any);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('should skip response turns with empty text', () => {
      const turn = new vsc.ChatResponseTurn('agent');
      (turn as any).response = [];
      const context = { history: [turn] };
      const messages = buildHistory(context as any);
      expect(messages).toHaveLength(0);
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

  describe('createCaptureStream', () => {
    it('should capture markdown text', () => {
      const inner = { markdown: vi.fn(), progress: vi.fn() };
      const [proxy, getText] = createCaptureStream(inner as any);

      proxy.markdown('Hello ');
      proxy.markdown('World');

      expect(getText()).toBe('Hello World');
      expect(inner.markdown).toHaveBeenCalledTimes(2);
      expect(inner.markdown).toHaveBeenCalledWith('Hello ');
      expect(inner.markdown).toHaveBeenCalledWith('World');
    });

    it('should handle MarkdownString objects', () => {
      const inner = { markdown: vi.fn() };
      const [proxy, getText] = createCaptureStream(inner as any);

      proxy.markdown({ value: 'md-content' } as any);
      expect(getText()).toBe('md-content');
    });

    it('should return empty string when nothing captured', () => {
      const inner = { markdown: vi.fn() };
      const [_proxy, getText] = createCaptureStream(inner as any);
      expect(getText()).toBe('');
    });

    it('should proxy non-markdown methods transparently', () => {
      const inner = { markdown: vi.fn(), progress: vi.fn(), anchor: vi.fn() };
      const [proxy] = createCaptureStream(inner as any);

      (proxy as any).progress('loading...');
      expect(inner.progress).toHaveBeenCalledWith('loading...');
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
