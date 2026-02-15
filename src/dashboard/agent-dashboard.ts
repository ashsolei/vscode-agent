import * as vscode from 'vscode';

/**
 * En loggpost för agentaktivitet.
 */
export interface ActivityEntry {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  prompt: string;
  durationMs?: number;
  status: 'running' | 'success' | 'error';
  error?: string;
}

/**
 * AgentDashboard — en webview-panel som visar agentaktivitet i realtid.
 */
export class AgentDashboard {
  private panel: vscode.WebviewPanel | undefined;
  private activities: ActivityEntry[] = [];
  private usageStats: Record<string, number> = {};
  private disposables: vscode.Disposable[] = [];
  private idCounter = 0;

  constructor(private extensionUri: vscode.Uri) {}

  /**
   * Visa eller fokusera dashboarden.
   */
  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'agentDashboard',
      '🤖 Agent Dashboard',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    }, null, this.disposables);

    this.updateContent();
  }

  /**
   * Logga att en agent startar.
   */
  logStart(agentId: string, agentName: string, prompt: string): string {
    const id = `${Date.now()}-${++this.idCounter}`;
    const entry: ActivityEntry = {
      id,
      timestamp: Date.now(),
      agentId,
      agentName,
      prompt: prompt.slice(0, 120),
      status: 'running',
    };

    this.activities.unshift(entry);
    if (this.activities.length > 100) {
      this.activities.pop();
    }

    this.usageStats[agentId] = (this.usageStats[agentId] ?? 0) + 1;
    this.updateContent();

    return id;
  }

  /**
   * Logga att en agent är klar.
   */
  logEnd(dashId: string, success: boolean, error?: string): void {
    const entry = this.activities.find(
      (a) => a.id === dashId
    );
    if (entry) {
      entry.status = success ? 'success' : 'error';
      entry.durationMs = Date.now() - entry.timestamp;
      entry.error = error;
      this.updateContent();
    }
  }

  /**
   * Uppdatera webview-innehållet.
   */
  private updateContent(): void {
    if (!this.panel) { return; }

    const running = this.activities.filter((a) => a.status === 'running').length;
    const totalSuccess = this.activities.filter((a) => a.status === 'success').length;
    const totalError = this.activities.filter((a) => a.status === 'error').length;
    const avgDuration = this.activities
      .filter((a) => a.durationMs)
      .reduce((s, a) => s + (a.durationMs ?? 0), 0) /
      Math.max(this.activities.filter((a) => a.durationMs).length, 1);

    // Top-agenter
    const topAgents = Object.entries(this.usageStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    this.panel.webview.html = this.getHtml(
      running, totalSuccess, totalError, avgDuration, topAgents
    );
  }

  private getHtml(
    running: number,
    success: number,
    errors: number,
    avgMs: number,
    topAgents: [string, number][]
  ): string {
    const activityRows = this.activities
      .slice(0, 30)
      .map((a) => {
        const status =
          a.status === 'running' ? '🔄'
            : a.status === 'success' ? '✅'
            : '❌';
        const time = new Date(a.timestamp).toLocaleTimeString();
        const dur = a.durationMs ? `${a.durationMs}ms` : '...';
        return `<tr>
          <td>${status}</td>
          <td><strong>${a.agentName}</strong></td>
          <td>${this.escapeHtml(a.prompt)}</td>
          <td>${dur}</td>
          <td>${time}</td>
        </tr>`;
      })
      .join('');

    const topRows = topAgents
      .map(([id, count]) => `<tr><td>${id}</td><td>${count}</td></tr>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Dashboard</title>
  <style>
    body {
      font-family: var(--vscode-font-family, system-ui);
      color: var(--vscode-foreground, #ccc);
      background: var(--vscode-editor-background, #1e1e1e);
      padding: 16px;
      margin: 0;
    }
    h1 { font-size: 1.5em; margin-bottom: 8px; }
    h2 { font-size: 1.1em; margin-top: 24px; color: var(--vscode-textLink-foreground, #4fc1ff); }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 16px 0;
    }
    .stat-card {
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-editorWidget-border, #454545);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-card .value {
      font-size: 2em;
      font-weight: bold;
      color: var(--vscode-textLink-foreground, #4fc1ff);
    }
    .stat-card .label {
      font-size: 0.85em;
      opacity: 0.7;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th, td {
      text-align: left;
      padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-editorWidget-border, #333);
    }
    th {
      background: var(--vscode-editorWidget-background, #252526);
      font-size: 0.85em;
      text-transform: uppercase;
      opacity: 0.8;
    }
    td { font-size: 0.9em; }
    .two-col {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    }
  </style>
</head>
<body>
  <h1>🤖 Agent Dashboard</h1>

  <div class="stats">
    <div class="stat-card">
      <div class="value">${running}</div>
      <div class="label">Aktiva</div>
    </div>
    <div class="stat-card">
      <div class="value">${success}</div>
      <div class="label">Lyckade</div>
    </div>
    <div class="stat-card">
      <div class="value">${errors}</div>
      <div class="label">Fel</div>
    </div>
    <div class="stat-card">
      <div class="value">${Math.round(avgMs)}<span style="font-size:0.4em">ms</span></div>
      <div class="label">Snitt-tid</div>
    </div>
  </div>

  <div class="two-col">
    <div>
      <h2>Senaste aktivitet</h2>
      <table>
        <thead><tr><th></th><th>Agent</th><th>Prompt</th><th>Tid</th><th>Klocka</th></tr></thead>
        <tbody>${activityRows || '<tr><td colspan="5">Ingen aktivitet ännu</td></tr>'}</tbody>
      </table>
    </div>
    <div>
      <h2>Mest använda</h2>
      <table>
        <thead><tr><th>Agent</th><th>Anrop</th></tr></thead>
        <tbody>${topRows || '<tr><td colspan="2">—</td></tr>'}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  dispose(): void {
    this.panel?.dispose();
    for (const d of this.disposables) { d.dispose(); }
  }
}
