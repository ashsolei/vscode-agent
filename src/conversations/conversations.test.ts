import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationPersistence, ChatMessage } from '../conversations/conversation-persistence';

function createMockMemento(): any {
  const store: Record<string, any> = {};
  return {
    get: vi.fn((key: string, defaultValue?: any) => store[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => { store[key] = value; }),
  };
}

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { role, content, timestamp: Date.now() };
}

describe('ConversationPersistence', () => {
  let conv: ConversationPersistence;
  let memento: any;

  beforeEach(() => {
    memento = createMockMemento();
    conv = new ConversationPersistence(memento);
  });

  it('should start with no conversations', () => {
    expect(conv.count).toBe(0);
    expect(conv.currentChat).toEqual([]);
  });

  it('should add messages and auto-create conversation', async () => {
    await conv.addMessage(msg('user', 'hello'));
    expect(conv.currentChat).toHaveLength(1);
    expect(conv.count).toBe(1);
  });

  it('should accumulate messages in session', async () => {
    await conv.addMessage(msg('user', 'hello'));
    await conv.addMessage(msg('assistant', 'hi there'));
    await conv.addMessage(msg('user', 'how are you?'));

    expect(conv.currentChat).toHaveLength(3);
  });

  it('should list conversations sorted by updatedAt', async () => {
    await conv.addMessage(msg('user', 'first'));
    await conv.startNew();
    await new Promise(r => setTimeout(r, 5)); // ensure different timestamp
    await conv.addMessage(msg('user', 'second'));

    const list = conv.list();
    expect(list).toHaveLength(2);
    // Most recent conversation first
    expect(list[0].messages[0].content).toBe('second');
  });

  it('should search conversations by content', async () => {
    await conv.addMessage(msg('user', 'TypeScript generics'));
    await conv.startNew();
    await conv.addMessage(msg('user', 'Python flask'));

    const results = conv.search('TypeScript');
    expect(results).toHaveLength(1);
    expect(results[0].messages[0].content).toContain('TypeScript');
  });

  it('should remove a conversation', async () => {
    await conv.addMessage(msg('user', 'to-delete'));
    const list = conv.list();
    const id = list[0].id;

    const removed = await conv.remove(id);
    expect(removed).toBe(true);
    expect(conv.count).toBe(0);
  });

  it('should tag a conversation', async () => {
    await conv.addMessage(msg('user', 'tagged'));
    const id = conv.list()[0].id;

    await conv.tag(id, ['important', 'review']);
    const tagged = conv.list()[0];
    expect(tagged.tags).toContain('important');
    expect(tagged.tags).toContain('review');
  });

  it('should toggle pin', async () => {
    await conv.addMessage(msg('user', 'pinned'));
    const id = conv.list()[0].id;

    await conv.togglePin(id);
    expect(conv.list({ pinned: true })).toHaveLength(1);

    await conv.togglePin(id);
    expect(conv.list({ pinned: true })).toHaveLength(0);
  });

  it('should start new conversation', async () => {
    await conv.addMessage(msg('user', 'first session'));
    await conv.startNew();

    expect(conv.currentChat).toEqual([]);
    await conv.addMessage(msg('user', 'second session'));
    expect(conv.count).toBe(2);
  });

  it('should load conversation', async () => {
    await conv.addMessage(msg('user', 'loadable'));
    const id = conv.list()[0].id;
    await conv.startNew();

    const loaded = await conv.loadConversation(id);
    expect(loaded).toBeDefined();
    expect(loaded!.messages[0].content).toBe('loadable');
    expect(conv.currentChat).toHaveLength(1);
  });

  it('should derive title from content', async () => {
    await conv.addMessage(msg('user', 'How to implement a binary search tree?'));
    const list = conv.list();
    expect(list[0].title).toContain('binary search');
  });
});
