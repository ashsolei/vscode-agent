#!/usr/bin/env bash
set -euo pipefail

# Script: Append missing sections to all Copilot agent files
# Adds: Capability Declarations, I/O Contract, Adaptation Hooks, Model Preferences

AGENTS_DIR=".github/copilot/agents"

# Agent-specific configurations
# Format: agent_name|capabilities|input|output|primary_model|fallback_model
declare -A AGENT_CAPS=(
  ["orchestrator"]="planning,coordination,tool-use,extended-thinking|User goal or task description, project context|Execution plan, agent dispatch instructions, quality gate results|Claude|GPT-4"
  ["architect"]="extended-thinking,large-context,codebase-search,structured-output|Architecture question, system requirements, codebase context|Architecture diagrams (Mermaid), design documents, ADRs, pattern recommendations|Claude|Gemini"
  ["developer"]="code-generation,tool-use,file-editing,terminal-access,codebase-search|Feature requirements, code context, file paths|Implemented code changes, new files, updated tests|Copilot|Claude"
  ["reviewer"]="large-context,codebase-search,structured-output|Code diff, file context, review criteria|Review comments, severity ratings, suggested fixes, approval status|Claude|Gemini"
  ["refactor"]="code-generation,codebase-search,file-editing,tool-use|Refactoring target, refactor type, current code|Refactored code, updated imports, migration notes|Copilot|Claude"
  ["performance"]="code-generation,profiling,codebase-search,terminal-access|Performance concern, code context, benchmark data|Optimization recommendations, profiled results, improved code|Claude|GPT-4"
  ["tester"]="code-generation,tool-use,terminal-access,codebase-search|Test target, code to test, existing test patterns|Test files, test results, coverage reports|Copilot|Claude"
  ["verification"]="tool-use,terminal-access,structured-output|Verification criteria, code changes, test results|Verification report, pass/fail status, issue list|Claude|GPT-4"
  ["ci"]="tool-use,terminal-access,file-editing,structured-output|CI/CD configuration, pipeline requirements, failure logs|Updated pipeline configs, fix recommendations, hardening changes|Copilot|Claude"
  ["security"]="code-analysis,codebase-search,structured-output,large-context|Security concern, code context, dependency list|Vulnerability report, remediation steps, security assessment|Claude|GPT-4"
  ["dependencies"]="tool-use,terminal-access,structured-output|Dependency list, update requirements, audit results|Updated package.json, audit report, migration guide|Copilot|Claude"
  ["secrets"]="codebase-search,code-analysis,structured-output|Repository context, secret patterns to scan for|Secrets scan report, remediation steps, secure configuration templates|Claude|GPT-4"
  ["compliance"]="large-context,structured-output,code-analysis|Compliance framework, codebase context, policy documents|Compliance report, gap analysis, remediation plan|Claude|GPT-4"
  ["deploy"]="tool-use,terminal-access,file-editing|Deployment target, environment config, release artifacts|Deployment scripts, rollback procedures, environment configs|Copilot|Claude"
  ["container"]="tool-use,terminal-access,file-editing|Container requirements, Dockerfile context, infrastructure needs|Dockerfile, compose configs, build scripts, optimization notes|Copilot|Claude"
  ["observability"]="code-generation,codebase-search,structured-output|Observability requirements, current logging/metrics setup|Logging implementation, metrics configuration, dashboard templates|Claude|Copilot"
  ["incident"]="extended-thinking,tool-use,terminal-access,structured-output|Incident description, error logs, system state|Root cause analysis, mitigation steps, post-mortem, prevention measures|Claude|GPT-4"
  ["api"]="code-generation,structured-output,codebase-search|API requirements, endpoint specifications, data models|API implementation, OpenAPI specs, client code, tests|Copilot|Claude"
  ["database"]="code-generation,structured-output,tool-use|Schema requirements, data model, migration needs|Schema definitions, migration files, ORM models, query optimizations|Claude|GPT-4"
  ["integration"]="code-generation,tool-use,codebase-search|Integration requirements, external API specs, auth config|Integration code, adapters, error handling, retry logic|Copilot|Claude"
  ["docs"]="large-context,codebase-search,structured-output|Documentation target, codebase context, audience|README updates, API docs, architecture docs, tutorials|Claude|Gemini"
  ["dx"]="codebase-search,code-generation,structured-output|Developer pain points, workflow analysis, tooling gaps|DX improvements, tooling configs, workflow scripts, onboarding guides|Claude|Copilot"
  ["ux"]="vision,structured-output,large-context|UI/UX requirements, design specs, screenshots|UX audit, accessibility report, component improvements|Claude|Gemini"
  ["ai-evolution"]="codebase-search,tool-use,file-editing,structured-output|New AI capability details, current agent inventory|Updated agents/skills/prompts, capability registry updates|Claude|GPT-4"
  ["copilot-features"]="codebase-search,tool-use,file-editing,structured-output|Copilot release notes, feature documentation|Feature integration code, updated prompts/skills, usage documentation|Copilot|Claude"
  ["claude-features"]="large-context,extended-thinking,structured-output|Claude release notes, capability documentation|Optimized prompts, workflow templates, capability matrix updates|Claude|GPT-4"
  ["gpt-features"]="function-calling,structured-output,code-generation|GPT release notes, API documentation|Integration code, optimized prompts, function schemas|GPT-4|Claude"
  ["gemini-features"]="multimodal,long-context,grounding,code-execution|Gemini release notes, API documentation|Integration workflows, grounded prompts, multimodal pipelines|Gemini|Claude"
  ["local-models"]="terminal-access,tool-use,file-editing|Model requirements, hardware specs, deployment target|Model config, deployment scripts, benchmark results, integration code|Copilot|Claude"
  ["model-router"]="structured-output,extended-thinking,codebase-search|Task description, model inventory, routing criteria|Routing decision, model selection, fallback chain, cost estimate|Claude|GPT-4"
  ["prompt-engineer"]="extended-thinking,structured-output,large-context|Prompt to optimize, task description, failure patterns|Optimized prompt, A/B test results, pattern library updates|Claude|GPT-4"
  ["capability-scanner"]="codebase-search,tool-use,structured-output|Capability sources to scan, current registry|Capability inventory, new capability alerts, registry updates|Claude|Copilot"
  ["mcp-integrator"]="tool-use,terminal-access,file-editing,codebase-search|MCP server to integrate, capability requirements|MCP configuration, agent bindings, capability mapping|Copilot|Claude"
  ["self-improve"]="extended-thinking,codebase-search,tool-use,file-editing|Agent performance data, failure patterns, improvement backlog|Updated agents/prompts/skills, improvement report, retrospective|Claude|GPT-4"
  ["error-recovery"]="tool-use,terminal-access,structured-output|Error details, failure context, retry history|Recovery action, fallback result, error classification, prevention recommendation|Claude|Copilot"
  ["context-manager"]="large-context,codebase-search,structured-output|Context requirements, codebase size, model constraints|Chunked context, summarization, context budget, cache recommendations|Gemini|Claude"
  ["conflict-resolver"]="extended-thinking,structured-output,codebase-search|Conflicting outputs, scope ownership data, quality gate results|Merged resolution, audit trail, escalation notice (if needed)|Claude|GPT-4"
  ["agent-tester"]="tool-use,terminal-access,codebase-search,structured-output|Agent to test, test scenarios, expected outputs|Test results, regression report, capability verification|Claude|Copilot"
  ["metrics"]="structured-output,codebase-search,tool-use|Agent performance data, system telemetry, cost data|Dashboard data, KPI report, trend analysis, recommendations|Claude|GPT-4"
  ["planner"]="extended-thinking,structured-output,codebase-search|Goal description, project context, constraints|Execution plan (dependency graph), risk assessment, effort estimates|Claude|GPT-4"
  ["roadmap"]="extended-thinking,large-context,structured-output|Project state, strategic goals, backlog|Roadmap document, quarterly plans, capability gap analysis|Claude|GPT-4"
  ["prioritizer"]="structured-output,extended-thinking|Work items, priority criteria, strategic alignment data|Priority-ranked list, RICE/WSJF scores, conflict resolution|Claude|GPT-4"
  ["devops"]="tool-use,terminal-access,file-editing,code-generation|Infrastructure requirements, CI/CD config, deployment targets|Pipeline configs, infrastructure code, deployment scripts|Copilot|Claude"
  ["troubleshoot"]="tool-use,terminal-access,codebase-search,extended-thinking|Error description, logs, system state|Root cause analysis, fix implementation, prevention steps|Claude|Copilot"
  ["vscode-api"]="codebase-search,code-generation,structured-output|VS Code API question, extension context|API usage examples, implementation code, best practices|Copilot|Claude"
  ["integrations"]="code-generation,tool-use,codebase-search|External service specs, integration requirements|Integration code, adapters, configuration, tests|Copilot|Claude"
)

append_sections() {
  local file="$1"
  local agent_name="$2"

  # Skip if already has these sections
  if grep -q "## Capability Declarations" "$file" 2>/dev/null; then
    echo "  SKIP $agent_name (already has sections)"
    return
  fi

  # Get agent config or use defaults
  local config="${AGENT_CAPS[$agent_name]:-"tool-use,codebase-search|User request and project context|Agent-specific output|Copilot|Claude"}"
  IFS='|' read -r caps input output primary fallback <<< "$config"

  # Ensure file ends with newline
  [ -n "$(tail -c1 "$file")" ] && echo "" >> "$file"

  cat >> "$file" << SECTIONS

## Capability Declarations

This agent requires the following AI capabilities:

$(echo "$caps" | tr ',' '\n' | while read -r cap; do echo "- **${cap}**"; done)

When a required capability is unavailable, fall back to the next-best alternative. Degrade gracefully — never fail silently.

## I/O Contract

**Input:**
- $input
- Shared workspace context from \`ContextProviderRegistry\`
- Agent memory from \`AgentMemory\` (relevant prior interactions)

**Output:**
- $output
- Structured metadata in \`AgentResult.metadata\`
- Optional follow-up suggestions in \`AgentResult.followUps\`

**Error Output:**
- Clear error description with root cause
- Suggested recovery action
- Escalation path if unrecoverable

## Adaptation Hooks

This agent should be updated when:

1. **New AI capabilities arrive** — check if new features improve this agent's task quality
2. **Project architecture changes** — update domain context and conventions
3. **New tools/MCP servers available** — integrate if relevant to this agent's scope
4. **Performance data shows degradation** — review and optimize prompts/workflows
5. **New best practices emerge** — incorporate improved patterns

**Self-check frequency:** After every major capability registry update.
**Update trigger:** When \`CAPABILITY-REGISTRY.md\` changes or \`self-improve\` agent flags this agent.

## Model Preferences

| Priority | Model | Reason |
|---|---|---|
| Primary | $primary | Best fit for this agent's primary tasks |
| Fallback 1 | $fallback | Good alternative with different strengths |
| Fallback 2 | Copilot | IDE-native integration, always available |
| Cost-sensitive | Local (Ollama) | For simple sub-tasks when cost matters |

Route via \`ModelSelector\` in code or \`model-router.md\` agent. Never hardcode a specific model version.
SECTIONS

  echo "  DONE $agent_name"
}

echo "═══════════════════════════════════════════"
echo "  Appending sections to all agent files"
echo "═══════════════════════════════════════════"

for file in "$AGENTS_DIR"/*.md; do
  agent_name=$(basename "$file" .md)
  append_sections "$file" "$agent_name"
done

echo ""
echo "Agent files updated."
