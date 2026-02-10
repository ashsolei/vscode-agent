import * as vscode from 'vscode';

/*
 * Extern integrations-hub: GitHub Issues, Slack, Jira (webhook-baserad).
 * Allt konfigureras via .agentrc.json → integrations.
 */

export interface IntegrationConfig {
  github?: { token?: string; repo?: string };
  slack?: { webhookUrl?: string; channel?: string };
  jira?: { baseUrl?: string; email?: string; token?: string; project?: string };
}

export interface IntegrationResult {
  provider: string;
  success: boolean;
  url?: string;
  message: string;
}

export class ExternalIntegrations implements vscode.Disposable {
  private config: IntegrationConfig = {};

  constructor() {
    this.loadConfig();
  }

  /** Ladda konfiguration från settings */
  private loadConfig(): void {
    const ws = vscode.workspace.getConfiguration('agent.integrations');
    this.config = {
      github: {
        token: ws.get<string>('github.token'),
        repo: ws.get<string>('github.repo'),
      },
      slack: {
        webhookUrl: ws.get<string>('slack.webhookUrl'),
        channel: ws.get<string>('slack.channel'),
      },
      jira: {
        baseUrl: ws.get<string>('jira.baseUrl'),
        email: ws.get<string>('jira.email'),
        token: ws.get<string>('jira.token'),
        project: ws.get<string>('jira.project'),
      },
    };
  }

  /* ─── GitHub ─── */

  /** Skapa en GitHub issue */
  async createGitHubIssue(title: string, body: string, labels?: string[]): Promise<IntegrationResult> {
    const { token, repo } = this.config.github ?? {};

    // Försök med Git-extension om inget token
    const effectiveRepo = repo || await this.detectGitHubRepo();
    if (!effectiveRepo) {
      return { provider: 'github', success: false, message: 'Ingen GitHub-repo konfigurerad. Sätt agent.integrations.github.repo' };
    }

    if (!token) {
      // Öppna i webbläsaren istället
      const encodedTitle = encodeURIComponent(title);
      const encodedBody = encodeURIComponent(body);
      const url = `https://github.com/${effectiveRepo}/issues/new?title=${encodedTitle}&body=${encodedBody}`;
      await vscode.env.openExternal(vscode.Uri.parse(url));
      return { provider: 'github', success: true, url, message: 'Issue öppnad i webbläsaren (inget token).' };
    }

    // API-anrop
    try {
      const response = await fetch(`https://api.github.com/repos/${effectiveRepo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'vscode-agent',
        },
        body: JSON.stringify({ title, body, labels: labels ?? [] }),
      });

      if (!response.ok) {
        return { provider: 'github', success: false, message: `GitHub API: ${response.status} ${response.statusText}` };
      }

      const data = await response.json() as { html_url: string; number: number };
      return {
        provider: 'github',
        success: true,
        url: data.html_url,
        message: `Issue #${data.number} skapad: ${data.html_url}`,
      };
    } catch (error) {
      return { provider: 'github', success: false, message: `GitHub-fel: ${error}` };
    }
  }

  /** Lista öppna GitHub-issues */
  async listGitHubIssues(limit: number = 10): Promise<IntegrationResult & { issues?: any[] }> {
    const { token, repo } = this.config.github ?? {};
    const effectiveRepo = repo || await this.detectGitHubRepo();

    if (!effectiveRepo) {
      return { provider: 'github', success: false, message: 'Ingen repo konfigurerad.' };
    }

    const headers: Record<string, string> = { 'User-Agent': 'vscode-agent' };
    if (token) { headers['Authorization'] = `Bearer ${token}`; }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${effectiveRepo}/issues?state=open&per_page=${limit}`,
        { headers }
      );

      if (!response.ok) {
        return { provider: 'github', success: false, message: `GitHub API: ${response.status}` };
      }

      const issues = await response.json() as any[];
      return {
        provider: 'github',
        success: true,
        message: `Hämtade ${issues.length} issues`,
        issues: issues.map((i: any) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          url: i.html_url,
          labels: i.labels?.map((l: any) => l.name) ?? [],
          created: i.created_at,
        })),
      };
    } catch (error) {
      return { provider: 'github', success: false, message: `${error}` };
    }
  }

  /* ─── Slack ─── */

  /** Skicka meddelande till Slack */
  async sendSlackMessage(text: string, blocks?: any[]): Promise<IntegrationResult> {
    const { webhookUrl } = this.config.slack ?? {};
    if (!webhookUrl) {
      return { provider: 'slack', success: false, message: 'Ingen Slack webhook konfigurerad. Sätt agent.integrations.slack.webhookUrl' };
    }

    try {
      const payload: any = { text };
      if (blocks) { payload.blocks = blocks; }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return { provider: 'slack', success: false, message: `Slack webhook: ${response.status}` };
      }

      return { provider: 'slack', success: true, message: 'Meddelande skickat till Slack.' };
    } catch (error) {
      return { provider: 'slack', success: false, message: `Slack-fel: ${error}` };
    }
  }

  /** Skicka agent-rapport till Slack */
  async sendSlackReport(agentId: string, summary: string, success: boolean): Promise<IntegrationResult> {
    const emoji = success ? '✅' : '❌';
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Agent Report: ${agentId}*\n\n${summary}`,
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `_Via VS Code Agent | ${new Date().toLocaleString()}_` },
        ],
      },
    ];
    return this.sendSlackMessage(`Agent ${agentId}: ${summary}`, blocks);
  }

  /* ─── Jira ─── */

  /** Skapa Jira-ticket */
  async createJiraIssue(
    summary: string,
    description: string,
    issueType: string = 'Bug'
  ): Promise<IntegrationResult> {
    const { baseUrl, email, token, project } = this.config.jira ?? {};

    if (!baseUrl || !email || !token || !project) {
      return {
        provider: 'jira',
        success: false,
        message: 'Jira ej konfigurerad. Sätt agent.integrations.jira.{baseUrl,email,token,project}',
      };
    }

    try {
      const auth = Buffer.from(`${email}:${token}`).toString('base64');
      const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: { key: project },
            summary,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: description }],
                },
              ],
            },
            issuetype: { name: issueType },
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return { provider: 'jira', success: false, message: `Jira: ${response.status} — ${text}` };
      }

      const data = await response.json() as { key: string; self: string };
      const url = `${baseUrl}/browse/${data.key}`;
      return {
        provider: 'jira',
        success: true,
        url,
        message: `Jira-ticket skapad: ${data.key} — ${url}`,
      };
    } catch (error) {
      return { provider: 'jira', success: false, message: `Jira-fel: ${error}` };
    }
  }

  /* ─── Universal ─── */

  /** Skapa issue via QuickPick (välj leverantör) */
  async createIssueInteractive(agentId: string, prompt: string, detail: string): Promise<void> {
    const providers: (vscode.QuickPickItem & { action: string })[] = [
      { label: '$(github) GitHub Issue', description: 'Skapa issue på GitHub', action: 'github' },
      { label: '$(comment) Slack', description: 'Skicka rapport till Slack', action: 'slack' },
      { label: '$(tasklist) Jira', description: 'Skapa Jira-ticket', action: 'jira' },
    ];

    const pick = await vscode.window.showQuickPick(providers, {
      title: 'Var vill du rapportera?',
      placeHolder: 'Välj tjänst...',
    });

    if (!pick) { return; }

    const title = `[Agent: ${agentId}] ${prompt}`;
    let result: IntegrationResult;

    switch (pick.action) {
      case 'github':
        result = await this.createGitHubIssue(title, detail, ['agent-generated']);
        break;
      case 'slack':
        result = await this.sendSlackReport(agentId, detail, true);
        break;
      case 'jira':
        result = await this.createJiraIssue(title, detail);
        break;
      default:
        return;
    }

    if (result.success) {
      const action = result.url ? 'Öppna' : undefined;
      const choice = await vscode.window.showInformationMessage(
        `✅ ${result.message}`,
        ...(action ? [action] : [])
      );
      if (choice === 'Öppna' && result.url) {
        await vscode.env.openExternal(vscode.Uri.parse(result.url));
      }
    } else {
      vscode.window.showErrorMessage(`❌ ${result.message}`);
    }
  }

  /** Lista tillgängliga integrationer */
  listAvailable(): string[] {
    const available: string[] = [];
    if (this.config.github?.token || this.config.github?.repo) { available.push('github'); }
    if (this.config.slack?.webhookUrl) { available.push('slack'); }
    if (this.config.jira?.baseUrl) { available.push('jira'); }
    return available;
  }

  /* ─── Helpers ─── */

  private async detectGitHubRepo(): Promise<string | undefined> {
    const gitExt = vscode.extensions.getExtension('vscode.git')?.exports;
    if (!gitExt) { return undefined; }
    const api = gitExt.getAPI(1);
    const repo = api?.repositories?.[0];
    if (!repo) { return undefined; }

    const remotes = repo.state.remotes;
    const origin = remotes.find((r: any) => r.name === 'origin');
    if (!origin?.fetchUrl) { return undefined; }

    // Extrahera owner/repo från URL
    const match = origin.fetchUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return match?.[1];
  }

  dispose(): void {
    // Inget att städa
  }
}
