import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { NotificationCenter, NotificationType } from './notification-center';

describe('NotificationCenter', () => {
  let center: NotificationCenter;

  beforeEach(() => {
    vi.clearAllMocks();
    center = new NotificationCenter();
  });

  // ─── Konstruktor ────────────────────────────

  describe('konstruktor', () => {
    it('ska skapa en statusbar-badge', () => {
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
        vscode.StatusBarAlignment.Right,
        200
      );
    });

    it('ska starta med 0 olästa', () => {
      expect(center.getUnreadCount()).toBe(0);
    });

    it('ska starta med tom historik', () => {
      expect(center.getHistory()).toEqual([]);
    });
  });

  // ─── notify ─────────────────────────────────

  describe('notify', () => {
    it('ska skicka info-notifiering via showInformationMessage', async () => {
      await center.notify('agent-1', 'TestAgent', 'info', 'Hej!');

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        '🤖 TestAgent: Hej!'
      );
    });

    it('ska skicka success-notifiering via showInformationMessage', async () => {
      await center.notify('agent-1', 'TestAgent', 'success', 'Klart!');

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        '🤖 TestAgent: Klart!'
      );
    });

    it('ska skicka warning-notifiering via showWarningMessage', async () => {
      await center.notify('agent-1', 'TestAgent', 'warning', 'Varning!');

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        '🤖 TestAgent: Varning!'
      );
    });

    it('ska skicka error-notifiering via showErrorMessage', async () => {
      await center.notify('agent-1', 'TestAgent', 'error', 'Fel!');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '🤖 TestAgent: Fel!'
      );
    });

    it('ska lägga till notifiering i historiken', async () => {
      await center.notify('agent-1', 'TestAgent', 'info', 'Test');

      const history = center.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].agentId).toBe('agent-1');
      expect(history[0].agentName).toBe('TestAgent');
      expect(history[0].type).toBe('info');
      expect(history[0].message).toBe('Test');
      expect(history[0].acknowledged).toBe(true);
    });

    it('ska generera unika notifierings-ID:n', async () => {
      await center.notify('a', 'A', 'info', 'Msg 1');
      await center.notify('b', 'B', 'info', 'Msg 2');

      const history = center.getHistory();
      expect(history[0].id).not.toBe(history[1].id);
    });

    it('ska inkludera detail i notifieringen', async () => {
      await center.notify('a', 'A', 'info', 'Msg', { detail: 'Extra info' });

      const history = center.getHistory();
      expect(history[0].detail).toBe('Extra info');
    });

    it('ska inkludera actions i notifieringen', async () => {
      const actions = [{ label: 'Öppna', command: 'cmd.open' }];
      await center.notify('a', 'A', 'info', 'Msg', { actions });

      const history = center.getHistory();
      expect(history[0].actions).toEqual(actions);
    });

    it('ska visa action-labels i VS Code toast', async () => {
      const actions = [
        { label: 'Visa', command: 'cmd.show' },
        { label: 'Stäng', command: 'cmd.close' },
      ];
      await center.notify('a', 'A', 'info', 'Msg', { actions });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        '🤖 A: Msg',
        'Visa',
        'Stäng'
      );
    });

    it('ska köra vald action-kommando', async () => {
      const actions = [{ label: 'DoIt', command: 'cmd.doit', args: ['arg1'] }];
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('DoIt' as any);

      await center.notify('a', 'A', 'info', 'Msg', { actions });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('cmd.doit', 'arg1');
    });

    it('ska inte köra action om användaren avbryter', async () => {
      const actions = [{ label: 'DoIt', command: 'cmd.doit' }];
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined);

      await center.notify('a', 'A', 'info', 'Msg', { actions });

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('ska trigga onDidNotify-eventet', async () => {
      const listener = vi.fn();
      center.onDidNotify(listener);

      await center.notify('a', 'A', 'info', 'Test');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'a', message: 'Test' })
      );
    });

    it('ska spela bell-ljud om sound är true', async () => {
      await center.notify('a', 'A', 'info', 'Ding', { sound: true });

      // playBell anropar vscode.window.withProgress
      expect(vscode.window.withProgress).toHaveBeenCalled();
    });
  });

  // ─── Olästa & badge ─────────────────────────

  describe('unread & badge', () => {
    it('ska räkna olästa korrekt', async () => {
      // notify markerar som acknowledged direkt, men räknar unread under notifieringen
      // Efter notify returnerar är den acknowledged => unreadCount minskar
      await center.notify('a', 'A', 'info', 'M1');
      // acknowledged => unread tillbaka till 0
      expect(center.getUnreadCount()).toBe(0);
    });

    it('ska uppdatera badge-text', () => {
      const badgeItem = vi.mocked(vscode.window.createStatusBarItem).mock.results[0].value;
      // Initialt, inga olästa => bell utan prick
      expect(badgeItem.text).toBe('$(bell)');
    });
  });

  // ─── notifyAgentDone ────────────────────────

  describe('notifyAgentDone', () => {
    it('ska notifiera om lyckad agent med success-typ', async () => {
      await center.notifyAgentDone('code', 'CodeAgent', true, 'Allt klart');

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        '🤖 CodeAgent: Klar!',
        'Visa Dashboard'
      );
    });

    it('ska notifiera om misslyckad agent med error-typ', async () => {
      await center.notifyAgentDone('code', 'CodeAgent', false, 'Timeout');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        '🤖 CodeAgent: Misslyckades',
        'Visa Dashboard'
      );
    });

    it('ska inkludera detail', async () => {
      await center.notifyAgentDone('code', 'CodeAgent', true, 'Detaljer här');

      const history = center.getHistory();
      expect(history[0].detail).toBe('Detaljer här');
    });

    it('ska spela ljud', async () => {
      await center.notifyAgentDone('code', 'CodeAgent', true);

      // sound: true => withProgress anropas för bell
      expect(vscode.window.withProgress).toHaveBeenCalled();
    });
  });

  // ─── withProgress ──────────────────────────

  describe('withProgress', () => {
    it('ska delegera till vscode.window.withProgress', async () => {
      const task = vi.fn().mockResolvedValue('result');

      const result = await center.withProgress('TestAgent', task);

      expect(vscode.window.withProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          location: vscode.ProgressLocation.Notification,
          title: '🤖 TestAgent',
          cancellable: true,
        }),
        task
      );
    });
  });

  // ─── Historik ───────────────────────────────

  describe('historik', () => {
    it('ska begränsa historiken till maxHistory (100)', async () => {
      for (let i = 0; i < 110; i++) {
        await center.notify('a', 'A', 'info', `Msg ${i}`);
      }

      const history = center.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('ska returnera en kopia av historiken', async () => {
      await center.notify('a', 'A', 'info', 'Test');

      const h1 = center.getHistory();
      const h2 = center.getHistory();
      expect(h1).not.toBe(h2); // inte samma referens
      expect(h1).toEqual(h2); // men samma innehåll
    });

    it('showHistory ska visa informationsmeddelande om tom', async () => {
      await center.showHistory();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Inga notifieringar.'
      );
    });

    it('showHistory ska visa QuickPick med notifieringar', async () => {
      await center.notify('a', 'AgentA', 'info', 'Meddelande 1');
      await center.notify('b', 'AgentB', 'warning', 'Meddelande 2');

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);
      await center.showHistory();

      expect(vscode.window.showQuickPick).toHaveBeenCalled();
      const items = vi.mocked(vscode.window.showQuickPick).mock.calls[0][0] as any[];
      expect(items).toHaveLength(2);
    });

    it('showHistory ska köra action på vald notifiering', async () => {
      await center.notify('a', 'A', 'info', 'Test', {
        actions: [{ label: 'Go', command: 'cmd.go', args: ['x'] }],
      });

      const history = center.getHistory();
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        notification: history[0],
      } as any);

      await center.showHistory();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('cmd.go', 'x');
    });
  });

  // ─── clearHistory ──────────────────────────

  describe('clearHistory', () => {
    it('ska tömma historiken', async () => {
      await center.notify('a', 'A', 'info', 'Test');
      expect(center.getHistory()).toHaveLength(1);

      center.clearHistory();
      expect(center.getHistory()).toHaveLength(0);
    });

    it('ska nollställa olästa', async () => {
      center.clearHistory();
      expect(center.getUnreadCount()).toBe(0);
    });
  });

  // ─── Notifieringstyper ─────────────────────

  describe('notifieringstyper', () => {
    const types: { type: NotificationType; mockFn: string }[] = [
      { type: 'info', mockFn: 'showInformationMessage' },
      { type: 'success', mockFn: 'showInformationMessage' },
      { type: 'warning', mockFn: 'showWarningMessage' },
      { type: 'error', mockFn: 'showErrorMessage' },
    ];

    for (const { type, mockFn } of types) {
      it(`ska använda ${mockFn} för typ "${type}"`, async () => {
        await center.notify('a', 'A', type, 'X');
        expect((vscode.window as any)[mockFn]).toHaveBeenCalled();
      });
    }
  });

  // ─── dispose ────────────────────────────────

  describe('dispose', () => {
    it('ska disponera badge och event emitter', () => {
      const badgeItem = vi.mocked(vscode.window.createStatusBarItem).mock.results[0].value;
      center.dispose();

      expect(badgeItem.dispose).toHaveBeenCalled();
    });

    it('ska tömma historiken', () => {
      center.dispose();
      expect(center.getHistory()).toHaveLength(0);
    });
  });

  // ─── Action utan args ──────────────────────

  describe('action utan args', () => {
    it('ska köra kommando med tom args-array', async () => {
      const actions = [{ label: 'Do', command: 'cmd.do' }]; // inga args
      vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Do' as any);

      await center.notify('a', 'A', 'info', 'Msg', { actions });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('cmd.do');
    });
  });
});
