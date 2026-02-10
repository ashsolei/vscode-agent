import { ITool, ToolResult } from './base-tool';
import { FileTool } from './file-tool';
import { SearchTool } from './search-tool';
import * as vscode from 'vscode';

export { BaseTool, type ITool, type ToolResult } from './base-tool';
export { FileTool } from './file-tool';
export { SearchTool } from './search-tool';

/**
 * ToolRegistry — centralt register för alla verktyg.
 */
export class ToolRegistry {
  private tools = new Map<string, ITool>();

  register(tool: ITool): void {
    this.tools.set(tool.id, tool);
  }

  get(id: string): ITool | undefined {
    return this.tools.get(id);
  }

  list(): ITool[] {
    return Array.from(this.tools.values());
  }

  async execute(
    toolId: string,
    params: Record<string, unknown>,
    token: vscode.CancellationToken
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { success: false, error: `Verktyg '${toolId}' finns inte` };
    }
    return tool.execute(params, token);
  }

  /**
   * Skapa ett ToolRegistry med standardverktyg.
   */
  static createDefault(): ToolRegistry {
    const registry = new ToolRegistry();
    registry.register(new FileTool());
    registry.register(new SearchTool());
    return registry;
  }
}
