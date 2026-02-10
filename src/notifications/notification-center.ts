import * as vscode from 'vscode';

/**
 * Notifieringstyp.
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * En agent-notifiering.
 */
export interface AgentNotification {
  id: string;
  agentId: string;
  agentName: string;
  type: NotificationType;
  message: string;
  detail?: string;
  timestamp: number;
  actions?: NotificationAction[];
  acknowledged: boolean;
}

/**
 * Åtgärd kopplad till en notifiering.
 */
export interface NotificationAction {
  label: string;
  command: string;
  args?: unknown[];
}

/**
 * NotificationCenter — hanterar agent-notifieringar med:
 *
 * - VS Code toast-meddelanden (info/warning/error)
 * - Notifieringshistorik
 * - Klickbara åtgärder
 * - Progress-toasts för långkörande agenter
 * - Sound-indikator (via terminal bell)
 * - Batchning av multipla notifieringar
 * - Status bar badge
 */
export class NotificationCenter implements vscode.Disposable {
  private history: AgentNotification[] = [];
  private maxHistory = 100;
  private _onDidNotify = new vscode.EventEmitter<AgentNotification>();
  readonly onDidNotify = this._onDidNotify.event;

  private unreadCount = 0;
  private badgeItem: vscode.StatusBarItem;

  constructor() {
    this.badgeItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      200
    );
    this.badgeItem.command = 'vscode-agent.showNotifications';
    this.updateBadge();
  }

  // ─── Notifiera ──────────────────────────────

  /**
   * Skicka en notifiering.
   */
  async notify(
    agentId: string,
    agentName: string,
    type: NotificationType,
    message: string,
    options?: {
      detail?: string;
      actions?: NotificationAction[];
      sound?: boolean;
    }
  ): Promise<void> {
    const notification: AgentNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      agentId,
      agentName,
      type,
      message,
      detail: options?.detail,
      timestamp: Date.now(),
      actions: options?.actions,
      acknowledged: false,
    };

    this.history.push(notification);
    this.trimHistory();
    this.unreadCount++;
    this.updateBadge();

    this._onDidNotify.fire(notification);

    // VS Code toast
    const fullMessage = `🤖 ${agentName}: ${message}`;
    const actionLabels = (options?.actions ?? []).map((a) => a.label);

    let selected: string | undefined;

    switch (type) {
      case 'error':
        selected = await vscode.window.showErrorMessage(fullMessage, ...actionLabels);
        break;
      case 'warning':
        selected = await vscode.window.showWarningMessage(fullMessage, ...actionLabels);
        break;
      case 'success':
      case 'info':
      default:
        selected = await vscode.window.showInformationMessage(fullMessage, ...actionLabels);
        break;
    }

    // Kör vald action
    if (selected && options?.actions) {
      const action = options.actions.find((a) => a.label === selected);
      if (action) {
        vscode.commands.executeCommand(action.command, ...(action.args ?? []));
      }
    }

    notification.acknowledged = true;
    this.unreadCount = Math.max(0, this.unreadCount - 1);
    this.updateBadge();

    // Terminal bell (ljud)
    if (options?.sound) {
      this.playBell();
    }
  }

  /**
   * Notifiera att en bakgrundsagent är klar.
   */
  async notifyAgentDone(
    agentId: string,
    agentName: string,
    success: boolean,
    detail?: string
  ): Promise<void> {
    await this.notify(
      agentId,
      agentName,
      success ? 'success' : 'error',
      success ? 'Klar!' : 'Misslyckades',
      {
        detail,
        sound: true,
        actions: [
          { label: 'Visa Dashboard', command: 'vscode-agent.showDashboard' },
        ],
      }
    );
  }

  /**
   * Visa progress med withProgress.
   */
  async withProgress<T>(
    agentName: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken
    ) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `🤖 ${agentName}`,
        cancellable: true,
      },
      task
    );
  }

  // ─── Historik ───────────────────────────────

  /**
   * Visa notifieringshistorik.
   */
  async showHistory(): Promise<void> {
    if (this.history.length === 0) {
      vscode.window.showInformationMessage('Inga notifieringar.');
      return;
    }

    const items = this.history
      .slice()
      .reverse()
      .map((n) => ({
        label: `${this.getIcon(n.type)} ${n.message}`,
        description: n.agentName,
        detail: `${new Date(n.timestamp).toLocaleString()}${n.detail ? ' — ' + n.detail : ''}`,
        notification: n,
      }));

    const selected = await vscode.window.showQuickPick(items, {
      title: `🔔 Notifieringar (${this.history.length})`,
      placeHolder: 'Välj en notifiering...',
    });

    if (selected?.notification.actions?.length) {
      const action = selected.notification.actions[0];
      vscode.commands.executeCommand(action.command, ...(action.args ?? []));
    }

    // Markera alla som lästa
    this.unreadCount = 0;
    this.updateBadge();
  }

  /**
   * Rensa historik.
   */
  clearHistory(): void {
    this.history = [];
    this.unreadCount = 0;
    this.updateBadge();
  }

  /**
   * Hämta olästa.
   */
  getUnreadCount(): number {
    return this.unreadCount;
  }

  /**
   * Hämta historik.
   */
  getHistory(): AgentNotification[] {
    return [...this.history];
  }

  // ─── Privata helpers ────────────────────────

  private getIcon(type: NotificationType): string {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': default: return 'ℹ️';
    }
  }

  private updateBadge(): void {
    if (this.unreadCount > 0) {
      this.badgeItem.text = `$(bell-dot) ${this.unreadCount}`;
      this.badgeItem.tooltip = `${this.unreadCount} olästa agent-notifieringar`;
      this.badgeItem.show();
    } else {
      this.badgeItem.text = '$(bell)';
      this.badgeItem.tooltip = 'Inga olästa notifieringar';
      // Dölj om ingen historik alls
      if (this.history.length > 0) {
        this.badgeItem.show();
      } else {
        this.badgeItem.hide();
      }
    }
  }

  private trimHistory(): void {
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  private playBell(): void {
    // Terminal bell — skickar BEL-tecken
    const terminal = vscode.window.terminals[0];
    if (terminal) {
      terminal.sendText('\x07', false);
    }
  }

  dispose(): void {
    this.badgeItem.dispose();
    this._onDidNotify.dispose();
  }
}
