import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationPersistence, ChatMessage } from './conversation-persistence';

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

function msg(role: 'user' | 'assistant', content: string, agentId?: string): ChatMessage {
  return { role, content, agentId, timestamp: Date.now() };
}

describe('ConversationPersistence — buildConversationContext', () => {
  let conv: ConversationPersistence;

  beforeEach(() => {
    conv = new ConversationPersistence(createMockMemento());
  });

  it('should return empty string when no messages', () => {
    expect(conv.buildConversationContext()).toBe('');
  });

  it('should build context from messages', async () => {
    await conv.addMessage(msg('user', 'Hello'));
    await conv.addMessage(msg('assistant', 'Hi there!', 'code'));

    const context = conv.buildConversationContext();
    expect(context).toContain('Konversationshistorik');
    expect(context).toContain('[Användare]: Hello');
    expect(context).toContain('[Agent (code)]: Hi there!');
    expect(context).toContain('Slut konversationshistorik');
  });

  it('should respect maxMessages parameter', async () => {
    for (let i = 0; i < 20; i++) {
      await conv.addMessage(msg('user', `Message ${i}`));
    }

    const context = conv.buildConversationContext(5);
    // Should only include the last 5 messages (15-19)
    expect(context).toContain('Message 19');
    expect(context).toContain('Message 15');
    expect(context).not.toContain('Message 14');
  });

  it('should respect maxChars parameter', async () => {
    await conv.addMessage(msg('user', 'A'.repeat(200)));
    await conv.addMessage(msg('assistant', 'B'.repeat(200), 'code'));
    await conv.addMessage(msg('user', 'C'.repeat(200)));

    const context = conv.buildConversationContext(10, 300);
    // Should stop adding messages when maxChars is exceeded
    expect(context.length).toBeLessThanOrEqual(400); // Some overhead for headers
  });

  it('should truncate individual long messages', async () => {
    await conv.addMessage(msg('user', 'X'.repeat(1000)));

    const context = conv.buildConversationContext();
    // Individual messages should be truncated to 500 chars
    expect(context).toContain('...');
    // The full 1000-char message should not appear
    expect(context).not.toContain('X'.repeat(1000));
  });

  it('should format assistant without agentId correctly', async () => {
    await conv.addMessage(msg('assistant', 'response'));

    const context = conv.buildConversationContext();
    expect(context).toContain('[Agent]: response');
  });

  it('should use recent messages (last N)', async () => {
    await conv.addMessage(msg('user', 'OLD_MESSAGE'));
    await conv.addMessage(msg('user', 'NEW_MESSAGE'));

    const context = conv.buildConversationContext(1);
    expect(context).toContain('NEW_MESSAGE');
    expect(context).not.toContain('OLD_MESSAGE');
  });
});
