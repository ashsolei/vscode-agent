import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { ExternalIntegrations } from './external-integrations';
import type { IntegrationResult } from './external-integrations';

/**
 * Tester för ExternalIntegrations — GitHub Issues, Slack, Jira.
 * Testar konfigurationsladdning, API-anrop och fallback-beteenden.
 */

// ─── Mock fetch ───

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Env-variabler ───

const originalEnv = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, val] of Object.entries(vars)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
}

function clearAllEnv() {
  delete process.env['GITHUB_TOKEN'];
  delete process.env['GITHUB_REPO'];
  delete process.env['SLACK_WEBHOOK_URL'];
  delete process.env['SLACK_CHANNEL'];
  delete process.env['JIRA_BASE_URL'];
  delete process.env['JIRA_EMAIL'];
  delete process.env['JIRA_TOKEN'];
  delete process.env['JIRA_PROJECT'];
}

describe('ExternalIntegrations', () => {
  let integrations: ExternalIntegrations;

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllEnv();
  });

  afterEach(() => {
    // Återställ env
    clearAllEnv();
    Object.assign(process.env, originalEnv);
  });

  // ─── GitHub ───

  describe('createGitHubIssue', () => {
    it('öppnar issue i webbläsaren om inget token finns', async () => {
      setEnv({ GITHUB_REPO: 'user/repo' });
      integrations = new ExternalIntegrations();

      const result = await integrations.createGitHubIssue('Bug', 'Detaljer');

      expect(result.provider).toBe('github');
      expect(result.success).toBe(true);
      expect(result.message).toContain('webbläsaren');
      expect(vscode.env.openExternal).toHaveBeenCalled();
    });

    it('returnerar fel om ingen repo konfigurerad och ingen git-extension', async () => {
      integrations = new ExternalIntegrations();
      // extensions.getExtension returnerar undefined (default mock)

      const result = await integrations.createGitHubIssue('Bug', 'Detaljer');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Ingen GitHub-repo');
    });

    it('skapar issue via API om token finns', async () => {
      setEnv({ GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'owner/repo' });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ html_url: 'https://github.com/owner/repo/issues/42', number: 42 }),
      });

      const result = await integrations.createGitHubIssue('Bug', 'Description', ['bug']);

      expect(result.success).toBe(true);
      expect(result.message).toContain('#42');
      expect(result.url).toContain('issues/42');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer ghp_test',
          }),
        })
      );
    });

    it('hanterar API-fel', async () => {
      setEnv({ GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'owner/repo' });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await integrations.createGitHubIssue('Titel', 'Body');

      expect(result.success).toBe(false);
      expect(result.message).toContain('401');
    });

    it('hanterar nätverksfel', async () => {
      setEnv({ GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'owner/repo' });
      integrations = new ExternalIntegrations();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await integrations.createGitHubIssue('Titel', 'Body');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });

  describe('listGitHubIssues', () => {
    it('hämtar öppna issues', async () => {
      setEnv({ GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'owner/repo' });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { number: 1, title: 'Bug A', state: 'open', html_url: 'url1', labels: [{ name: 'bug' }], created_at: '2025-01-01' },
          { number: 2, title: 'Feature B', state: 'open', html_url: 'url2', labels: [], created_at: '2025-01-02' },
        ],
      });

      const result = await integrations.listGitHubIssues(5);

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(2);
      expect(result.issues![0].number).toBe(1);
      expect(result.issues![0].labels).toEqual(['bug']);
    });

    it('returnerar fel utan repo', async () => {
      integrations = new ExternalIntegrations();

      const result = await integrations.listGitHubIssues();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Ingen repo');
    });

    it('hanterar API-fel vid lista', async () => {
      setEnv({ GITHUB_REPO: 'owner/repo' });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      const result = await integrations.listGitHubIssues();

      expect(result.success).toBe(false);
      expect(result.message).toContain('403');
    });
  });

  // ─── Slack ───

  describe('sendSlackMessage', () => {
    it('skickar meddelande via webhook', async () => {
      setEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await integrations.sendSlackMessage('Hello Slack');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('slack');
      expect(result.message).toContain('Slack');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('returnerar fel om webhook saknas', async () => {
      integrations = new ExternalIntegrations();

      const result = await integrations.sendSlackMessage('Test');

      expect(result.success).toBe(false);
      expect(result.message).toContain('webhook');
    });

    it('hanterar webhook-fel', async () => {
      setEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await integrations.sendSlackMessage('Test');

      expect(result.success).toBe(false);
      expect(result.message).toContain('500');
    });

    it('inkluderar blocks om de skickats', async () => {
      setEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({ ok: true });

      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Hi' } }];
      await integrations.sendSlackMessage('text', blocks);

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.blocks).toEqual(blocks);
    });

    it('hanterar nätverksfel', async () => {
      setEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' });
      integrations = new ExternalIntegrations();

      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await integrations.sendSlackMessage('Test');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection refused');
    });
  });

  describe('sendSlackReport', () => {
    it('skickar rapport med blocks', async () => {
      setEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await integrations.sendSlackReport('code', 'Allt ok', true);

      expect(result.success).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.blocks).toBeDefined();
      expect(body.blocks[0].text.text).toContain('code');
    });

    it('visar rätt emoji för success/fail', async () => {
      setEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test' });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValue({ ok: true });

      await integrations.sendSlackReport('agent', 'Success', true);
      const successBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(successBody.blocks[0].text.text).toContain('✅');

      await integrations.sendSlackReport('agent', 'Failure', false);
      const failBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(failBody.blocks[0].text.text).toContain('❌');
    });
  });

  // ─── Jira ───

  describe('createJiraIssue', () => {
    it('skapar Jira-ticket via API', async () => {
      setEnv({
        JIRA_BASE_URL: 'https://test.atlassian.net',
        JIRA_EMAIL: 'user@test.com',
        JIRA_TOKEN: 'jira-token',
        JIRA_PROJECT: 'PROJ',
      });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'PROJ-123', self: 'https://test.atlassian.net/rest/api/3/issue/123' }),
      });

      const result = await integrations.createJiraIssue('Bug', 'Detaljer', 'Bug');

      expect(result.success).toBe(true);
      expect(result.message).toContain('PROJ-123');
      expect(result.url).toContain('browse/PROJ-123');
    });

    it('returnerar fel om konfiguration saknas', async () => {
      integrations = new ExternalIntegrations();

      const result = await integrations.createJiraIssue('Summary', 'Desc');

      expect(result.success).toBe(false);
      expect(result.message).toContain('ej konfigurerad');
    });

    it('hanterar API-fel', async () => {
      setEnv({
        JIRA_BASE_URL: 'https://test.atlassian.net',
        JIRA_EMAIL: 'user@test.com',
        JIRA_TOKEN: 'jira-token',
        JIRA_PROJECT: 'PROJ',
      });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      const result = await integrations.createJiraIssue('Summary', 'Desc');

      expect(result.success).toBe(false);
      expect(result.message).toContain('400');
    });

    it('hanterar nätverksfel', async () => {
      setEnv({
        JIRA_BASE_URL: 'https://test.atlassian.net',
        JIRA_EMAIL: 'user@test.com',
        JIRA_TOKEN: 'token',
        JIRA_PROJECT: 'PROJ',
      });
      integrations = new ExternalIntegrations();

      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const result = await integrations.createJiraIssue('Summary', 'Desc');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Timeout');
    });

    it('inkluderar rätt issue type i request-body', async () => {
      setEnv({
        JIRA_BASE_URL: 'https://test.atlassian.net',
        JIRA_EMAIL: 'u@t.com',
        JIRA_TOKEN: 't',
        JIRA_PROJECT: 'P',
      });
      integrations = new ExternalIntegrations();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'P-1', self: '' }),
      });

      await integrations.createJiraIssue('S', 'D', 'Story');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.fields.issuetype.name).toBe('Story');
    });
  });

  // ─── listAvailable ───

  describe('listAvailable', () => {
    it('returnerar tom lista utan konfiguration', () => {
      integrations = new ExternalIntegrations();
      expect(integrations.listAvailable()).toEqual([]);
    });

    it('returnerar github om repo finns', () => {
      setEnv({ GITHUB_REPO: 'owner/repo' });
      integrations = new ExternalIntegrations();
      expect(integrations.listAvailable()).toContain('github');
    });

    it('returnerar github om token finns', () => {
      setEnv({ GITHUB_TOKEN: 'tok' });
      integrations = new ExternalIntegrations();
      expect(integrations.listAvailable()).toContain('github');
    });

    it('returnerar slack om webhook finns', () => {
      setEnv({ SLACK_WEBHOOK_URL: 'https://hooks.slack.com/x' });
      integrations = new ExternalIntegrations();
      expect(integrations.listAvailable()).toContain('slack');
    });

    it('returnerar jira om baseUrl finns', () => {
      setEnv({ JIRA_BASE_URL: 'https://jira.test.com' });
      integrations = new ExternalIntegrations();
      expect(integrations.listAvailable()).toContain('jira');
    });

    it('returnerar alla om allt konfigurerat', () => {
      setEnv({
        GITHUB_TOKEN: 'x',
        SLACK_WEBHOOK_URL: 'x',
        JIRA_BASE_URL: 'x',
      });
      integrations = new ExternalIntegrations();
      const avail = integrations.listAvailable();
      expect(avail).toContain('github');
      expect(avail).toContain('slack');
      expect(avail).toContain('jira');
    });
  });

  // ─── createIssueInteractive ───

  describe('createIssueInteractive', () => {
    it('gör inget om användaren avbryter quickpick', async () => {
      integrations = new ExternalIntegrations();
      vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);

      await integrations.createIssueInteractive('code', 'prompt', 'detail');

      // Inget API-anrop gjort
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('anropar GitHub vid val av github', async () => {
      setEnv({ GITHUB_REPO: 'owner/repo' });
      integrations = new ExternalIntegrations();

      vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
        { label: 'GitHub', action: 'github' } as any
      );

      await integrations.createIssueInteractive('code', 'prompt', 'detail');

      // Öppnas i browser (inget token)
      expect(vscode.env.openExternal).toHaveBeenCalled();
    });

    it('visar felmeddelande vid misslyckad integration', async () => {
      integrations = new ExternalIntegrations();

      vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(
        { label: 'Slack', action: 'slack' } as any
      );

      await integrations.createIssueInteractive('code', 'prompt', 'detail');

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  // ─── dispose ───

  describe('dispose', () => {
    it('rensar konfiguration vid dispose', () => {
      setEnv({ GITHUB_TOKEN: 'secret', SLACK_WEBHOOK_URL: 'url' });
      integrations = new ExternalIntegrations();

      expect(integrations.listAvailable().length).toBeGreaterThan(0);

      integrations.dispose();
      // Config cleared — listAvailable returnerar tomma
      expect(integrations.listAvailable()).toEqual([]);
    });
  });
});
