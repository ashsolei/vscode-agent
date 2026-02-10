import * as vscode from 'vscode';

/**
 * En enskild telemetripost.
 */
export interface TelemetryEntry {
  agentId: string;
  agentName: string;
  command: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  error?: string;
  promptLength: number;
  responseLength?: number;
  model?: string;
}

interface AgentStats {
  calls: number;
  successCount: number;
  failCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  lastUsed: number;
}

const TELEMETRY_KEY = 'agent.telemetry';
const MAX_ENTRIES = 5000;

export class TelemetryEngine implements vscode.Disposable {
  private entries: TelemetryEntry[] = [];
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly globalState: vscode.Memento) {
    this.entries = globalState.get<TelemetryEntry[]>(TELEMETRY_KEY, []);
  }

  /** Logga ett anrop */
  async log(entry: TelemetryEntry): Promise<void> {
    this.entries.push(entry);
    // Trimma
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
    await this.globalState.update(TELEMETRY_KEY, this.entries);
    // Uppdatera dashboard om öppet
    this.refreshPanel();
  }

  /** Statistik per agent */
  agentStats(): Record<string, AgentStats> {
    const stats: Record<string, AgentStats> = {};
    for (const e of this.entries) {
      if (!stats[e.agentId]) {
        stats[e.agentId] = {
          calls: 0,
          successCount: 0,
          failCount: 0,
          totalDurationMs: 0,
          avgDurationMs: 0,
          lastUsed: 0,
        };
      }
      const s = stats[e.agentId];
      s.calls++;
      if (e.success) { s.successCount++; } else { s.failCount++; }
      s.totalDurationMs += e.durationMs;
      s.avgDurationMs = Math.round(s.totalDurationMs / s.calls);
      s.lastUsed = Math.max(s.lastUsed, e.timestamp);
    }
    return stats;
  }

  /** Övergripande statistik */
  overview(): {
    totalCalls: number;
    successRate: number;
    avgDuration: number;
    topAgent: string;
    entriesCount: number;
    uniqueAgents: number;
    last24h: number;
    last7d: number;
  } {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const stats = this.agentStats();
    const agentIds = Object.keys(stats);
    const total = this.entries.length;
    const success = this.entries.filter((e) => e.success).length;
    const avgDur = total > 0
      ? Math.round(this.entries.reduce((acc, e) => acc + e.durationMs, 0) / total)
      : 0;

    let topAgent = '-';
    let topCalls = 0;
    for (const [id, s] of Object.entries(stats)) {
      if (s.calls > topCalls) {
        topCalls = s.calls;
        topAgent = id;
      }
    }

    return {
      totalCalls: total,
      successRate: total > 0 ? Math.round((success / total) * 100) : 0,
      avgDuration: avgDur,
      topAgent,
      entriesCount: total,
      uniqueAgents: agentIds.length,
      last24h: this.entries.filter((e) => now - e.timestamp < day).length,
      last7d: this.entries.filter((e) => now - e.timestamp < 7 * day).length,
    };
  }

  /** Timme-serie för grafer */
  hourlyBreakdown(days: number = 7): { hour: string; count: number; successRate: number }[] {
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const recent = this.entries.filter((e) => e.timestamp >= cutoff);

    const buckets: Map<string, { count: number; success: number }> = new Map();

    for (const e of recent) {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
      if (!buckets.has(key)) {
        buckets.set(key, { count: 0, success: 0 });
      }
      const b = buckets.get(key)!;
      b.count++;
      if (e.success) { b.success++; }
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, data]) => ({
        hour,
        count: data.count,
        successRate: Math.round((data.success / data.count) * 100),
      }));
  }

  /** Daglig sammanställning */
  dailySummary(days: number = 30): { date: string; calls: number; success: number; avgMs: number }[] {
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const recent = this.entries.filter((e) => e.timestamp >= cutoff);

    const buckets: Map<string, { calls: number; success: number; totalMs: number }> = new Map();

    for (const e of recent) {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!buckets.has(key)) {
        buckets.set(key, { calls: 0, success: 0, totalMs: 0 });
      }
      const b = buckets.get(key)!;
      b.calls++;
      if (e.success) { b.success++; }
      b.totalMs += e.durationMs;
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        calls: data.calls,
        success: data.success,
        avgMs: Math.round(data.totalMs / data.calls),
      }));
  }

  /** Rensa all telemetri */
  async clear(): Promise<void> {
    this.entries = [];
    await this.globalState.update(TELEMETRY_KEY, []);
  }

  /** Visa analytics dashboard i webview */
  show(_extensionUri: vscode.Uri): void {
    if (this.panel) {
      this.panel.reveal();
      this.refreshPanel();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'agentAnalytics',
      '📊 Agent Analytics',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    this.panel.onDidDispose(() => { this.panel = undefined; });
    this.refreshPanel();
  }

  private refreshPanel(): void {
    if (!this.panel) { return; }

    const overview = this.overview();
    const agentStats = this.agentStats();
    const daily = this.dailySummary(14);
    const _hourly = this.hourlyBreakdown(3);

    // Sortera agenter efter anrop
    const sortedAgents = Object.entries(agentStats)
      .sort(([, a], [, b]) => b.calls - a.calls);

    const agentRows = sortedAgents
      .map(([id, s]) => `
        <tr>
          <td><strong>${id}</strong></td>
          <td>${s.calls}</td>
          <td>${Math.round((s.successCount / s.calls) * 100)}%</td>
          <td>${s.avgDurationMs}ms</td>
          <td>${s.failCount}</td>
          <td>${new Date(s.lastUsed).toLocaleString()}</td>
        </tr>
      `).join('');

    const dailyLabels = JSON.stringify(daily.map((d) => d.date));
    const dailyCalls = JSON.stringify(daily.map((d) => d.calls));
    const dailySuccessData = JSON.stringify(daily.map((d) => d.success));

    const topAgentLabels = JSON.stringify(sortedAgents.slice(0, 10).map(([id]) => id));
    const topAgentCalls = JSON.stringify(sortedAgents.slice(0, 10).map(([, s]) => s.calls));

    this.panel.webview.html = /* html */ `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    :root { --bg: var(--vscode-editor-background); --fg: var(--vscode-editor-foreground); }
    body { font-family: var(--vscode-font-family); color: var(--fg); padding: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border); border-radius: 8px; padding: 16px; text-align: center; }
    .card .value { font-size: 2em; font-weight: bold; color: var(--vscode-textLink-foreground); }
    .card .label { font-size: 0.85em; opacity: 0.7; margin-top: 4px; }
    h1 { margin-bottom: 8px; }
    h2 { margin-top: 32px; border-bottom: 1px solid var(--vscode-editorWidget-border); padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--vscode-editorWidget-border); }
    th { opacity: 0.7; font-weight: 600; }
    .bar-chart { display: flex; gap: 4px; align-items: flex-end; height: 120px; margin-top: 16px; }
    .bar-chart .bar { flex: 1; background: var(--vscode-textLink-foreground); border-radius: 4px 4px 0 0; min-width: 8px; position: relative; transition: all 0.2s; }
    .bar-chart .bar:hover { opacity: 0.8; }
    .bar-chart .bar .tip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border); padding: 2px 6px; border-radius: 4px; font-size: 0.75em; white-space: nowrap; display: none; }
    .bar-chart .bar:hover .tip { display: block; }
    .bar-labels { display: flex; gap: 4px; font-size: 0.7em; opacity: 0.5; margin-top: 4px; }
    .bar-labels span { flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meter { height: 8px; border-radius: 4px; background: var(--vscode-progressBar-background); }
    .meter-bg { background: var(--vscode-editorWidget-border); border-radius: 4px; overflow: hidden; }
    .success-color { color: #4caf50; }
    .fail-color { color: #f44336; }
    .refresh-btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; margin-left: 12px; }
  </style>
</head>
<body>
  <h1>📊 Agent Analytics <button class="refresh-btn" onclick="location.reload()">Uppdatera</button></h1>
  <p style="opacity:0.6">Realtidsstatistik för alla agentanrop</p>

  <div class="grid">
    <div class="card">
      <div class="value">${overview.totalCalls}</div>
      <div class="label">Totala anrop</div>
    </div>
    <div class="card">
      <div class="value ${overview.successRate >= 90 ? 'success-color' : overview.successRate >= 70 ? '' : 'fail-color'}">${overview.successRate}%</div>
      <div class="label">Lyckandegrad</div>
    </div>
    <div class="card">
      <div class="value">${overview.avgDuration}ms</div>
      <div class="label">Snitttid</div>
    </div>
    <div class="card">
      <div class="value">${overview.uniqueAgents}</div>
      <div class="label">Unika agenter</div>
    </div>
    <div class="card">
      <div class="value">${overview.last24h}</div>
      <div class="label">Senaste 24h</div>
    </div>
    <div class="card">
      <div class="value">${overview.topAgent}</div>
      <div class="label">Populäraste agent</div>
    </div>
  </div>

  <h2>📈 Daglig aktivitet (14 dagar)</h2>
  <div class="bar-chart" id="dailyChart"></div>
  <div class="bar-labels" id="dailyLabels"></div>

  <h2>🏆 Top 10 agenter</h2>
  <div class="bar-chart" id="agentChart"></div>
  <div class="bar-labels" id="agentLabels"></div>

  <h2>📋 Agent-rapport</h2>
  <table>
    <thead>
      <tr><th>Agent</th><th>Anrop</th><th>Success</th><th>Snitt</th><th>Fel</th><th>Senast</th></tr>
    </thead>
    <tbody>${agentRows}</tbody>
  </table>

  <script>
    function renderBars(containerId, labelId, labels, values, color) {
      const max = Math.max(...values, 1);
      const container = document.getElementById(containerId);
      const labelRow = document.getElementById(labelId);
      container.innerHTML = '';
      labelRow.innerHTML = '';
      values.forEach((v, i) => {
        const pct = (v / max) * 100;
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = pct + '%';
        if (color) bar.style.background = color;
        const tip = document.createElement('div');
        tip.className = 'tip';
        tip.textContent = labels[i] + ': ' + v;
        bar.appendChild(tip);
        container.appendChild(bar);

        const lbl = document.createElement('span');
        lbl.textContent = labels[i].split(' ').pop() || labels[i];
        labelRow.appendChild(lbl);
      });
    }

    const dailyLabels = ${dailyLabels};
    const dailyCalls = ${dailyCalls};
    const dailySuccess = ${dailySuccessData};
    const agentLabels = ${topAgentLabels};
    const agentCalls = ${topAgentCalls};

    renderBars('dailyChart', 'dailyLabels', dailyLabels, dailyCalls);
    renderBars('agentChart', 'agentLabels', agentLabels, agentCalls, '#e91e63');
  </script>
</body>
</html>`;
  }

  /** Total */
  get totalEntries(): number {
    return this.entries.length;
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
