import * as vscode from 'vscode';
import { BaseTool, ToolResult } from './base-tool';

/**
 * Verktyg för att köra terminala kommandon i arbetsytan.
 */
export class TerminalTool extends BaseTool {
  constructor() {
    super('terminal', 'Terminalverktyg', 'Kör kommandon i en terminal i arbetsytan');
  }

  async execute(
    params: Record<string, unknown>,
    _token: vscode.CancellationToken
  ): Promise<ToolResult> {
    const command = params['command'] as string;
    if (!command) {
      return this.failure('Kommando saknas');
    }

    const cwd = params['cwd'] as string | undefined;

    try {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) {
        return this.failure('Ingen arbetsyta öppen');
      }

      // Validera cwd — avvisa path traversal
      if (cwd) {
        const segments = cwd.split('/');
        if (segments.some(s => s === '..')) {
          return this.failure(`cwd '${cwd}' innehåller otillåtna '..' segment`);
        }
        const resolved = vscode.Uri.joinPath(ws.uri, cwd);
        const root = ws.uri.fsPath;
        if (!resolved.fsPath.startsWith(root + '/') && resolved.fsPath !== root) {
          return this.failure(`cwd '${cwd}' pekar utanför arbetsytan`);
        }
      }

      // Blockera farliga kommandon
      const blocked = ['rm -rf /', 'mkfs', 'dd if=', ':(){', 'fork bomb', '> /dev/sd'];
      const cmdLower = command.toLowerCase();
      if (blocked.some(b => cmdLower.includes(b))) {
        return this.failure(`Kommandot blockerades av säkerhetsskydd`);
      }

      // Skapa en terminal och kör kommandot
      const terminal = vscode.window.createTerminal({
        name: `Agent: ${command.slice(0, 30)}`,
        cwd: cwd ? vscode.Uri.joinPath(ws.uri, cwd) : ws.uri,
      });

      terminal.sendText(command);
      terminal.show(true);

      return this.success({
        command,
        message: `Kommando startat i terminal: ${command}`,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'okänt fel';
      return this.failure(`Misslyckades köra kommando: ${detail}`);
    }
  }
}
