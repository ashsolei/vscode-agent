import * as vscode from 'vscode';
import { BaseTool, ToolResult } from './base-tool';

/**
 * Verktyg för filoperationer — läsa, söka och lista filer i arbetsytan.
 */
export class FileTool extends BaseTool {
  constructor() {
    super('file', 'Filverktyg', 'Läs, sök och lista filer i arbetsytan');
  }

  /**
   * Validate a relative path stays within the workspace root.
   */
  private validatePath(filePath: string, wsRoot: vscode.WorkspaceFolder): vscode.Uri {
    const uri = vscode.Uri.joinPath(wsRoot.uri, filePath);
    const resolved = uri.fsPath;
    const root = wsRoot.uri.fsPath;
    if (!resolved.startsWith(root + '/') && resolved !== root) {
      throw new Error(`Sökvägen '${filePath}' pekar utanför arbetsytan`);
    }
    return uri;
  }

  async execute(
    params: Record<string, unknown>,
    _token: vscode.CancellationToken
  ): Promise<ToolResult> {
    const action = params['action'] as string;

    switch (action) {
      case 'read':
        return this.readFile(params['path'] as string);
      case 'search':
        return this.searchFiles(params['pattern'] as string);
      case 'list':
        return this.listFiles(params['directory'] as string);
      default:
        return this.failure(`Okänd filåtgärd: ${action}`);
    }
  }

  private async readFile(filePath: string): Promise<ToolResult> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return this.failure('Ingen arbetsyta öppen');
      }

      const uri = this.validatePath(filePath, workspaceFolders[0]);
      const content = await vscode.workspace.fs.readFile(uri);
      return this.success(new TextDecoder().decode(content));
    } catch (error) {
      const msg = error instanceof Error ? error.message : `Kunde inte läsa fil: ${filePath}`;
      return this.failure(msg);
    }
  }

  private async searchFiles(pattern: string): Promise<ToolResult> {
    try {
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 50);
      return this.success(files.map((f) => f.fsPath));
    } catch (error) {
      return this.failure(`Sökning misslyckades: ${pattern}`);
    }
  }

  private async listFiles(directory?: string): Promise<ToolResult> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return this.failure('Ingen arbetsyta öppen');
      }

      const baseUri = directory
        ? this.validatePath(directory, workspaceFolders[0])
        : workspaceFolders[0].uri;

      const entries = await vscode.workspace.fs.readDirectory(baseUri);
      return this.success(
        entries.map(([name, type]) => ({
          name,
          type: type === vscode.FileType.Directory ? 'directory' : 'file',
        }))
      );
    } catch (error) {
      return this.failure(`Kunde inte lista katalog: ${directory}`);
    }
  }
}
