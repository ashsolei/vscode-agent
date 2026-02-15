---
mode: "agent"
description: "Discover, evaluate, and integrate an MCP server — test capabilities, create agent bindings, document in CAPABILITY-REGISTRY.md"
---

# MCP Server Integration

You are an MCP integration engineer for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, ToolRegistry, AgentRegistry, zero runtime deps).

## Steps

1. **Discover and evaluate the MCP server**
   - Identify the MCP server's capabilities: tools, resources, prompts it exposes.
   - Test the server locally to verify it starts and responds correctly.
   ```bash
   # Example: test MCP server connectivity
   npx @modelcontextprotocol/inspector <server-command>
   ```
   - Assess which of the 30+ agents can benefit from the server's tools.
   - Verify no runtime dependency is needed in the extension itself.

2. **Configure MCP server in VS Code**
   - Add server configuration to `.vscode/mcp.json` or user settings.
   - Document required environment variables and authentication.
   - Test the connection from VS Code's MCP panel.

3. **Create agent bindings**
   - Identify agents that should use the MCP server's tools.
   - Update agent prompts in `src/agents/<name>-agent.ts` to reference available MCP tools.
   - If the MCP server adds a new capability, consider creating a new agent following `new-agent.prompt.md`.
   - Register new tools in `src/tools/index.ts` if wrapping MCP tools for agent use.

4. **Test the integration**
   - Write Vitest tests mocking the MCP server responses.
   - Test tool invocation through `ToolRegistry` in `src/tools/index.ts`.
   - Verify agents handle MCP server errors gracefully (timeout, unavailable, malformed response).
   ```bash
   npm run compile && npm test
   ```

5. **Handle offline/unavailable scenarios**
   - Ensure agents degrade gracefully when the MCP server is not running.
   - Add error handling in the agent's `handle(ctx)` method for MCP failures.
   - Consider caching MCP responses via `ResponseCache` for frequently-used queries.

6. **Document the integration**
   - Update `CAPABILITY-REGISTRY.md` with the MCP server's capabilities and which agents use them.
   - Add setup instructions to `README.md` under an MCP section.
   - Update `CHANGELOG.md`.

## Quality Checklist
- [ ] Zero new runtime dependencies in the extension
- [ ] MCP server config documented in `.vscode/mcp.json` or README
- [ ] Agent bindings tested with mocked MCP responses
- [ ] Graceful degradation when MCP server is unavailable
- [ ] CAPABILITY-REGISTRY.md updated with MCP capabilities
- [ ] Environment variables and auth requirements documented

## Pitfalls to Avoid
- Installing MCP client libraries as runtime dependencies — use VS Code's built-in MCP support.
- Assuming the MCP server is always available — always handle connection failures.
- Exposing sensitive MCP server credentials in committed config files.
- Not testing with the MCP server actually running before writing tests.
- Creating overly tight coupling between agents and specific MCP tools.
