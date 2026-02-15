---
name: "MCP Server Management"
description: "MCP server lifecycle: discovery, evaluation, installation, configuration, capability mapping, agent binding, monitoring, retirement"
argument-hint: "MCP server name or action"
---

# MCP Server Management

Manage the full lifecycle of Model Context Protocol (MCP) servers for the VS Code Agent extension — from discovery through retirement. MCP servers extend agent capabilities via external tools.

## Workflow

1. **Discover** — find MCP servers relevant to agent tasks (file operations, search, git, database, API).
2. **Evaluate** — assess security, reliability, maintenance status, and capability overlap with existing tools.
3. **Install** — configure in VS Code settings or `.vscode/mcp.json`.
4. **Map** capabilities — link MCP tools to `ToolRegistry` (`src/tools/index.ts`) entries.
5. **Bind** to agents — configure which agents can invoke which MCP tools.
6. **Test** — verify tool execution via agent interactions.
7. **Monitor** — track usage, latency, errors via `AgentDashboard` (`src/dashboard/agent-dashboard.ts`).
8. **Retire** — remove unused or replaced MCP servers cleanly.

## Templates

### .vscode/mcp.json configuration

```json
{
  "servers": {
    "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."] },
    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_TOKEN": "${env:GITHUB_TOKEN}" } }
  }
}
```

### Capability mapping to ToolRegistry

```typescript
// In src/tools/index.ts — map MCP tools to internal registry
toolRegistry.register({
    name: 'mcp_filesystem_read',
    description: 'Read file via MCP filesystem server',
    execute: async (args: { path: string }) => {
        // Delegate to MCP server — validatePath() first
        const safePath = validatePath(args.path, workspaceRoot);
        return await mcpClient.callTool('filesystem', 'read_file', { path: safePath });
    }
});
```

### Agent binding in .agentrc.json

```json
{
  "mcpBindings": {
    "code": ["filesystem", "github"],
    "git": ["github"],
    "database": ["postgres-mcp"],
    "docs": ["filesystem"]
  }
}
```

### MCP server evaluation template

```markdown
## Server: [Name]
- **Source/Capabilities/Overlap:** npm|GitHub, tools provided, vs existing ToolRegistry
- **Security:** Filesystem/network/credential access?
- **Maintenance:** Last update, issue count, maintainer activity
- **Decision:** Install / Defer / Decline — **Rationale:** ...
```

## Rules

- MCP servers are external processes — zero runtime dependencies rule still applies to the extension itself.
- All file paths from MCP tools must pass through `validatePath()` in `AutonomousExecutor` (`src/autonomous/executor.ts`) — prevent path traversal.
- MCP tool execution must go through `ToolRegistry` (`src/tools/index.ts`) — never invoke MCP tools directly from agents.
- Agent bindings restrict which agents can use which MCP servers — principle of least privilege.
- Security-sensitive MCP servers (filesystem, git, database) require `GuardRails` (`src/guardrails/guardrails.ts`) checkpoints when used autonomously.
- MCP server errors are isolated — a failing server must not crash the agent pipeline.
- Environment variables for MCP servers use `${env:VAR}` syntax — never hardcode secrets.
- Monitor MCP server health in `MiddlewarePipeline` (`src/middleware/middleware.ts`) before-hooks.
- Retirement: remove config, unbind agents, update `ToolRegistry`, run `npm run compile && npm test`.

## Checklist

- [ ] MCP server discovered and evaluation completed
- [ ] Security review passed — no unrestricted filesystem/network access
- [ ] `.vscode/mcp.json` configured with server entry
- [ ] Capabilities mapped to `ToolRegistry` entries
- [ ] `validatePath()` enforced for all file-related MCP tools
- [ ] Agent bindings configured in `.agentrc.json`
- [ ] `GuardRails` checkpoints added for autonomous use
- [ ] Integration tested — agents successfully invoke MCP tools
- [ ] Error handling verified — MCP failure doesn't crash pipeline
- [ ] `npm run compile && npm test` passes
