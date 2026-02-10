import * as vscode from 'vscode';

/**
 * Resultat från ett verktygsanrop.
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Bas-interface för alla verktyg som agenter kan använda.
 */
export interface ITool {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  execute(params: Record<string, unknown>, token: vscode.CancellationToken): Promise<ToolResult>;
}

/**
 * Abstrakt basklass för verktyg med gemensam logik.
 */
export abstract class BaseTool implements ITool {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string
  ) {}

  abstract execute(
    params: Record<string, unknown>,
    token: vscode.CancellationToken
  ): Promise<ToolResult>;

  protected success(data: unknown): ToolResult {
    return { success: true, data };
  }

  protected failure(error: string): ToolResult {
    return { success: false, error };
  }
}
