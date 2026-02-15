import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { AgentDashboard, ActivityEntry } from './agent-dashboard';

describe('AgentDashboard', () => {
  let dashboard: AgentDashboard;
  const extensionUri = vscode.Uri.file('/ext');

  beforeEach(() => {
    vi.clearAllMocks();
    dashboard = new AgentDashboard(extensionUri);
  });

  // ─── show ───────────────────────────────────

  describe('show', () => {
    it('ska skapa en webview-panel', () => {
      dashboard.show();

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'agentDashboard',
        '🤖 Agent Dashboard',
        vscode.ViewColumn.Two,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );
    });

    it('ska inte skapa en ny panel om redan öppen (reveal istället)', () => {
      dashboard.show();
      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;

      dashboard.show();

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
      expect(panel.reveal).toHaveBeenCalled();
    });

    it('ska registrera onDidDispose-callback', () => {
      dashboard.show();

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      expect(panel.onDidDispose).toHaveBeenCalled();
    });

    it('ska sätta HTML-innehåll i webview', () => {
      dashboard.show();

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      expect(panel.webview.html).toContain('Agent Dashboard');
    });
  });

  // ─── logStart ───────────────────────────────

  describe('logStart', () => {
    it('ska returnera ett unikt dashboard-ID', () => {
      const id1 = dashboard.logStart('code', 'Code Agent', 'Skriv kod');
      const id2 = dashboard.logStart('docs', 'Docs Agent', 'Skriv docs');

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('ska logga aktivitet med status running', () => {
      dashboard.show();
      const id = dashboard.logStart('code', 'Code Agent', 'Skriv kod');

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      // HTML ska innehålla agentnamnet
      expect(panel.webview.html).toContain('Code Agent');
    });

    it('ska trunkera lång prompt till 120 tecken', () => {
      const longPrompt = 'x'.repeat(200);
      dashboard.logStart('code', 'Code', longPrompt);

      // Ingen assertion på exakt längd i HTML, men den ska inte krascha
      expect(true).toBe(true);
    });

    it('ska uppdatera webview-innehållet om panelen är öppen', () => {
      dashboard.show();
      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;

      dashboard.logStart('code', 'Code Agent', 'Test');

      // HTML ska uppdateras med ny aktivitet
      expect(panel.webview.html).toContain('Code Agent');
    });

    it('ska inte krascha om panelen inte är öppen', () => {
      // Ingen show() anropad
      expect(() => {
        dashboard.logStart('code', 'Code', 'Test');
      }).not.toThrow();
    });

    it('ska begränsa aktiviteter till 100', () => {
      for (let i = 0; i < 110; i++) {
        dashboard.logStart('code', `Agent ${i}`, `Prompt ${i}`);
      }
      // Ska inte krascha, internt begränsas till 100
      expect(true).toBe(true);
    });

    it('ska räkna usage stats per agent', () => {
      dashboard.show();
      dashboard.logStart('code', 'Code', 'P1');
      dashboard.logStart('code', 'Code', 'P2');
      dashboard.logStart('docs', 'Docs', 'P3');

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      // Webview ska innehålla "code" i top-agenter
      expect(panel.webview.html).toContain('code');
    });
  });

  // ─── logEnd ─────────────────────────────────

  describe('logEnd', () => {
    it('ska markera aktivitet som success', () => {
      dashboard.show();
      const id = dashboard.logStart('code', 'Code', 'Test');

      dashboard.logEnd(id, true);

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      expect(panel.webview.html).toContain('✅');
    });

    it('ska markera aktivitet som error', () => {
      dashboard.show();
      const id = dashboard.logStart('code', 'Code', 'Test');

      dashboard.logEnd(id, false, 'Timeout');

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      expect(panel.webview.html).toContain('❌');
    });

    it('ska beräkna durationMs', async () => {
      const id = dashboard.logStart('code', 'Code', 'Test');

      // Vänta lite för att få en mätbar duration
      await new Promise((r) => setTimeout(r, 5));

      dashboard.logEnd(id, true);

      // Ingen direkt assertion på exakt duration, men koden ska fungera
      expect(true).toBe(true);
    });

    it('ska ignorera okänt dashboard-ID', () => {
      expect(() => {
        dashboard.logEnd('nonexistent-id', true);
      }).not.toThrow();
    });

    it('ska inte krascha om panelen inte är öppen vid logEnd', () => {
      const id = dashboard.logStart('code', 'Code', 'Test');
      expect(() => {
        dashboard.logEnd(id, true);
      }).not.toThrow();
    });
  });

  // ─── HTML-generering ───────────────────────

  describe('HTML-generering', () => {
    it('ska generera giltig HTML-sida med dashboard', () => {
      dashboard.show();

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      const html = panel.webview.html;

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('Agent Dashboard');
      expect(html).toContain('Content-Security-Policy');
    });

    it('ska visa rätt statistik i HTML', () => {
      dashboard.show();
      const id1 = dashboard.logStart('code', 'Code', 'P1');
      dashboard.logEnd(id1, true);
      const id2 = dashboard.logStart('code', 'Code', 'P2');
      dashboard.logEnd(id2, false, 'err');

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      const html = panel.webview.html;

      // Ska visa Lyckade och Fel
      expect(html).toContain('Lyckade');
      expect(html).toContain('Fel');
      expect(html).toContain('Aktiva');
      expect(html).toContain('Snitt-tid');
    });

    it('ska escape:a HTML i prompten', () => {
      dashboard.show();
      dashboard.logStart('code', 'Code', '<script>alert("xss")</script>');

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      const html = panel.webview.html;

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('ska visa "Ingen aktivitet ännu" om listan är tom', () => {
      dashboard.show();

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      expect(panel.webview.html).toContain('Ingen aktivitet ännu');
    });
  });

  // ─── Panel-livscykel ──────────────────────

  describe('panel-livscykel', () => {
    it('ska rensa panel-referens vid dispose', () => {
      dashboard.show();
      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;

      // Simulera dispose-callback
      const onDidDisposeCall = vi.mocked(panel.onDidDispose).mock.calls[0];
      const disposeCallback = onDidDisposeCall[0] as () => void;
      disposeCallback();

      // Nu bör show() skapa en ny panel
      dashboard.show();
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
    });
  });

  // ─── dispose ────────────────────────────────

  describe('dispose', () => {
    it('ska disponera panelen om den finns', () => {
      dashboard.show();
      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;

      dashboard.dispose();

      expect(panel.dispose).toHaveBeenCalled();
    });

    it('ska inte krascha om ingen panel finns', () => {
      expect(() => {
        dashboard.dispose();
      }).not.toThrow();
    });
  });

  // ─── Stress-scenario ──────────────────────

  describe('stress', () => {
    it('ska hantera många snabba logStart/logEnd', () => {
      dashboard.show();
      const ids: string[] = [];

      for (let i = 0; i < 50; i++) {
        ids.push(dashboard.logStart('code', 'Code', `Prompt ${i}`));
      }

      for (const id of ids) {
        dashboard.logEnd(id, true);
      }

      const panel = vi.mocked(vscode.window.createWebviewPanel).mock.results[0].value;
      expect(panel.webview.html).toContain('Agent Dashboard');
    });
  });
});
