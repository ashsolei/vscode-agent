import * as vscode from 'vscode';
import { BaseTool, ToolResult } from './base-tool';

/**
 * Verktyg för att hämta diagnostik (fel/varningar) från arbetsytan.
 */
export class DiagnosticsTool extends BaseTool {
  constructor() {
    super('diagnostics', 'Diagnostikverktyg', 'Hämta kompileringsfel och varningar från arbetsytan');
  }

  async execute(
    params: Record<string, unknown>,
    _token: vscode.CancellationToken
  ): Promise<ToolResult> {
    const action = params['action'] as string ?? 'list';
    const filePath = params['file'] as string | undefined;
    const severityFilter = params['severity'] as string | undefined;

    switch (action) {
      case 'list':
        return this.listDiagnostics(filePath, severityFilter);
      case 'count':
        return this.countDiagnostics(filePath, severityFilter);
      case 'summary':
        return this.summarizeDiagnostics();
      default:
        return this.failure(`Okänd åtgärd: ${action}`);
    }
  }

  private listDiagnostics(filePath?: string, severityFilter?: string): ToolResult {
    const allDiags = vscode.languages.getDiagnostics();
    const results: Array<{ file: string; line: number; message: string; severity: string; source?: string }> = [];

    for (const [uri, diags] of allDiags) {
      const relativePath = vscode.workspace.asRelativePath(uri);

      // Filtrera på fil om angett
      if (filePath && !relativePath.includes(filePath)) {
        continue;
      }

      for (const d of diags) {
        const sev = this.severityLabel(d.severity);

        // Filtrera på allvarlighetsgrad
        if (severityFilter && sev !== severityFilter) {
          continue;
        }

        results.push({
          file: relativePath,
          line: d.range.start.line + 1,
          message: d.message,
          severity: sev,
          source: d.source,
        });
      }
    }

    return this.success({
      count: results.length,
      diagnostics: results.slice(0, 50),
    });
  }

  private countDiagnostics(filePath?: string, severityFilter?: string): ToolResult {
    const allDiags = vscode.languages.getDiagnostics();
    let errors = 0;
    let warnings = 0;
    let info = 0;
    let hints = 0;

    for (const [uri, diags] of allDiags) {
      if (filePath) {
        const relativePath = vscode.workspace.asRelativePath(uri);
        if (!relativePath.includes(filePath)) { continue; }
      }

      for (const d of diags) {
        const sev = this.severityLabel(d.severity);
        if (severityFilter && sev !== severityFilter) { continue; }

        switch (d.severity) {
          case vscode.DiagnosticSeverity.Error: errors++; break;
          case vscode.DiagnosticSeverity.Warning: warnings++; break;
          case vscode.DiagnosticSeverity.Information: info++; break;
          case vscode.DiagnosticSeverity.Hint: hints++; break;
        }
      }
    }

    return this.success({ errors, warnings, info, hints, total: errors + warnings + info + hints });
  }

  private summarizeDiagnostics(): ToolResult {
    const allDiags = vscode.languages.getDiagnostics();
    const fileErrors = new Map<string, number>();

    for (const [uri, diags] of allDiags) {
      const errorCount = diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
      if (errorCount > 0) {
        fileErrors.set(vscode.workspace.asRelativePath(uri), errorCount);
      }
    }

    // Sortera efter felantal (flest först)
    const sorted = Array.from(fileErrors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([file, count]) => ({ file, errors: count }));

    return this.success({
      filesWithErrors: sorted.length,
      topFiles: sorted,
    });
  }

  private severityLabel(severity: vscode.DiagnosticSeverity): string {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error: return 'error';
      case vscode.DiagnosticSeverity.Warning: return 'warning';
      case vscode.DiagnosticSeverity.Information: return 'info';
      case vscode.DiagnosticSeverity.Hint: return 'hint';
      default: return 'unknown';
    }
  }
}
