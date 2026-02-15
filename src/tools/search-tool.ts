import * as vscode from 'vscode';
import { BaseTool, ToolResult } from './base-tool';

/**
 * Verktyg för textsökning i arbetsytan.
 */
export class SearchTool extends BaseTool {
  constructor() {
    super('search', 'Sökverktyg', 'Sök text i filer i arbetsytan');
  }

  async execute(
    params: Record<string, unknown>,
    _token: vscode.CancellationToken
  ): Promise<ToolResult> {
    const query = params['query'] as string;
    const includePattern = params['include'] as string | undefined;

    if (!query) {
      return this.failure('Sökterm saknas');
    }

    try {
      // Använd VS Code:s inbyggda textsökning
      const results: Array<{ file: string; line: number; text: string }> = [];

      // Utför sökning via workspace API
      const files = await vscode.workspace.findFiles(
        includePattern ?? '**/*',
        '**/node_modules/**',
        100
      );

      for (const file of files) {
        try {
          const content = await vscode.workspace.fs.readFile(file);
          const text = new TextDecoder().decode(content);
          const lines = text.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query.toLowerCase())) {
              results.push({
                file: vscode.workspace.asRelativePath(file),
                line: i + 1,
                text: lines[i].trim(),
              });
            }
          }
        } catch {
          // Hoppa över filer som inte kan läsas
        }
      }

      return this.success({
        query,
        matchCount: results.length,
        results: results.slice(0, 20), // Begränsa resultaten
      });
    } catch (error) {
      return this.failure(`Sökning misslyckades: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
