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

  // ─── deriveTitle edge cases ───

  it('should truncate long titles at 50 chars', async () => {
    const long = 'A'.repeat(100);
    await conv.addMessage(msg('user', long));
    const list = conv.list();
    expect(list[0].title.length).toBeLessThanOrEqual(50);
    expect(list[0].title).toContain('...');
  });

  it('should strip markdown formatting from title', async () => {
    await conv.addMessage(msg('user', '# How to **implement** _generics_'));
    const list = conv.list();
    expect(list[0].title).not.toContain('#');
    expect(list[0].title).not.toContain('*');
    expect(list[0].title).not.toContain('_');
  });

  it('should use fallback title for empty content', async () => {
    await conv.addMessage(msg('user', ''));
    const list = conv.list();
    expect(list[0].title).toBe('Ny konversation');
  });

  // ─── Remove current conversation ───

  it('should reset current state when removing active conversation', async () => {
    await conv.addMessage(msg('user', 'to remove'));
    const id = conv.list()[0].id;
    expect(conv.currentChat).toHaveLength(1);

    await conv.remove(id);
    expect(conv.currentChat).toEqual([]);
    expect(conv.count).toBe(0);
  });

  it('should return false when removing non-existent conversation', async () => {
    const result = await conv.remove('non-existent');
    expect(result).toBe(false);
  });

  // ─── currentChat returns copy ───

  it('should return a copy of current messages', async () => {
    await conv.addMessage(msg('user', 'test'));
    const chat = conv.currentChat;
    chat.push(msg('user', 'injected'));
    // Internal state should not be affected
    expect(conv.currentChat).toHaveLength(1);
  });

  // ─── loadConversation unknown ───

  it('should return undefined for unknown conversation id', async () => {
    const result = await conv.loadConversation('unknown-id');
    expect(result).toBeUndefined();
  });

  // ─── saveCurrentAs ───

  it('should save current conversation with explicit title', async () => {
    await conv.addMessage(msg('user', 'hello'));
    const saved = await conv.saveCurrentAs('My Title');
    expect(saved).toBeDefined();
    expect(saved!.title).toBe('My Title');
    expect(saved!.messages).toHaveLength(1);
  });

  it('should return undefined when no messages to save', async () => {
    const saved = await conv.saveCurrentAs('Empty');
    expect(saved).toBeUndefined();
  });

  // ─── buildConversationContext ───

  describe('buildConversationContext', () => {
    it('should return empty string when no messages', () => {
      const ctx = conv.buildConversationContext();
      expect(ctx).toBe('');
    });

    it('should build context with user and assistant messages', async () => {
      await conv.addMessage(msg('user', 'hello'));
      await conv.addMessage({ role: 'assistant', content: 'hi there', agentId: 'code', timestamp: Date.now() });

      const ctx = conv.buildConversationContext();
      expect(ctx).toContain('Konversationshistorik');
      expect(ctx).toContain('[Användare]: hello');
      expect(ctx).toContain('[Agent (code)]: hi there');
      expect(ctx).toContain('Slut konversationshistorik');
    });

    it('should include agent without agentId', async () => {
      await conv.addMessage({ role: 'assistant', content: 'response', timestamp: Date.now() });
      const ctx = conv.buildConversationContext();
      expect(ctx).toContain('[Agent]: response');
    });

    it('should respect maxMessages', async () => {
      for (let i = 0; i < 20; i++) {
        await conv.addMessage(msg('user', `msg-${i}`));
      }
      const ctx = conv.buildConversationContext(3);
      // Should only contain last 3 messages
      expect(ctx).toContain('msg-17');
      expect(ctx).toContain('msg-18');
      expect(ctx).toContain('msg-19');
      expect(ctx).not.toContain('msg-0');
    });

    it('should respect maxChars limit', async () => {
      for (let i = 0; i < 50; i++) {
        await conv.addMessage(msg('user', `Message number ${i} with some extra content padding`));
      }
      const ctx = conv.buildConversationContext(50, 200);
      expect(ctx.length).toBeLessThanOrEqual(300); // some overhead for header/footer
    });

    it('should truncate long individual messages at 500 chars', async () => {
      const longContent = 'A'.repeat(1000);
      await conv.addMessage(msg('user', longContent));
      const ctx = conv.buildConversationContext();
      // The individual message should be truncated
      expect(ctx).toContain('...');
      // Should not contain the full 1000-char content
      expect(ctx.length).toBeLessThan(1000);
    });
  });

  // ─── list with filters ───

  describe('list filters', () => {
    it('should filter by tag', async () => {
      await conv.addMessage(msg('user', 'conv1'));
      const id = conv.list()[0].id;
      await conv.tag(id, ['react']);
      await conv.startNew();
      await conv.addMessage(msg('user', 'conv2'));

      const results = conv.list({ tag: 'react' });
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('react');
    });

    it('should filter by pinned=false', async () => {
      await conv.addMessage(msg('user', 'pinned'));
      const id = conv.list()[0].id;
      await conv.togglePin(id);
      await conv.startNew();
      await conv.addMessage(msg('user', 'unpinned'));

      const unpinned = conv.list({ pinned: false });
      expect(unpinned).toHaveLength(1);
      expect(unpinned[0].pinned).toBe(false);
    });
  });

  // ─── search edge cases ───

  describe('search', () => {
    it('should search in tags', async () => {
      await conv.addMessage(msg('user', 'hello'));
      const id = conv.list()[0].id;
      await conv.tag(id, ['important']);

      const results = conv.search('important');
      expect(results).toHaveLength(1);
    });

    it('should search in title', async () => {
      await conv.addMessage(msg('user', 'React components guide'));
      const results = conv.search('React');
      expect(results).toHaveLength(1);
    });

    it('should return empty for no match', () => {
      expect(conv.search('nonexistent')).toHaveLength(0);
    });
  });

  // ─── tag/togglePin unknown Id ───

  it('should gracefully ignore tag for unknown id', async () => {
    await conv.tag('unknown', ['test']);
    // Should not throw
    expect(conv.count).toBe(0);
  });

  it('should gracefully ignore togglePin for unknown id', async () => {
    await conv.togglePin('unknown');
    // Should not throw
    expect(conv.count).toBe(0);
  });

  // ─── Dispose ───

  it('should not throw on dispose', async () => {
    await conv.addMessage(msg('user', 'before dispose'));
    expect(() => conv.dispose()).not.toThrow();
  });

  it('should save state on dispose when messages exist', async () => {
    await conv.addMessage(msg('user', 'save on dispose'));
    memento.update.mockClear();
    conv.dispose();
    expect(memento.update).toHaveBeenCalled();
  });
});
