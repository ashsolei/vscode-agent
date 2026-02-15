---
name: "Local Model Deployment"
description: "Deploy local/open-source models: model selection, quantization, Ollama/vLLM setup, hardware requirements, integration with ModelSelector"
argument-hint: "Model name or 'setup'"
---

# Local Model Deployment

Deploy and integrate local or open-source AI models with the VS Code Agent extension. Covers model selection criteria, quantization trade-offs, Ollama/vLLM runtime setup, hardware sizing, and wiring into `ModelSelector` (`src/models/model-selector.ts`).

## Workflow

1. **Assess** hardware — GPU VRAM, system RAM, disk space, CPU cores.
2. **Select** a model — match task requirements (code generation, review, explanation) to model strengths.
3. **Choose** a runtime — Ollama for single-GPU simplicity, vLLM for throughput.
4. **Quantize** if needed — GGUF Q4/Q5/Q8 for constrained hardware.
5. **Configure** the runtime — endpoint, context window, temperature defaults.
6. **Integrate** with `ModelSelector` — add model entry in `.agentrc.json` `models` config.
7. **Test** — run agents against local model, compare quality to cloud baseline.
8. **Monitor** — track latency, token throughput, error rates via `AgentDashboard` (`src/dashboard/agent-dashboard.ts`).

## Templates

### Ollama setup

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a code-focused model
ollama pull codellama:13b-instruct-q5_K_M
ollama pull deepseek-coder:6.7b-instruct-q5_K_M

# Verify endpoint
curl http://localhost:11434/api/tags
```

### .agentrc.json model configuration

```json
{
  "models": {
    "local-codellama": {
      "provider": "ollama",
      "endpoint": "http://localhost:11434",
      "model": "codellama:13b-instruct-q5_K_M",
      "contextWindow": 16384,
      "maxTokens": 4096
    }
  },
  "agentModels": {
    "code": "local-codellama",
    "explain": "local-codellama",
    "review": "copilot-default"
  }
}
```

### Hardware sizing reference

| Model Size | Quantization | Min VRAM | Min RAM | Disk  |
|-----------|-------------|----------|---------|-------|
| 7B        | Q4_K_M      | 4 GB     | 8 GB    | 4 GB  |
| 13B       | Q5_K_M      | 10 GB    | 16 GB   | 9 GB  |
| 34B       | Q4_K_M      | 20 GB    | 32 GB   | 20 GB |
| 70B       | Q4_K_M      | 40 GB    | 64 GB   | 40 GB |

### Validate integration

```bash
npm run compile && npm test
# Test specific agent with local model
# Use Health Check: Cmd+Shift+P → Agent: Health Check
```

## Rules

- `ModelSelector` (`src/models/model-selector.ts`) reads model config from `.agentrc.json` via `ConfigManager` (`src/config/config-manager.ts`).
- Local models are fallback-only by default — cloud models take priority unless explicitly overridden.
- Never commit API keys or endpoint credentials — use VS Code settings or environment variables.
- Context window limits must be respected — `ModelSelector` should reject prompts exceeding the model's capacity.
- Quantization below Q4 is discouraged — quality degrades significantly for code tasks.
- All model endpoints must be health-checked before routing — use `MiddlewarePipeline` (`src/middleware/middleware.ts`) for pre-request validation.
- Zero runtime dependencies rule still applies — Ollama/vLLM are external services, not bundled.
- Test with `npm run compile && npm test` after any `ModelSelector` changes.

## Checklist

- [ ] Hardware assessed — VRAM, RAM, disk verified for target model
- [ ] Runtime installed and running (Ollama or vLLM)
- [ ] Model pulled/downloaded and responding on expected endpoint
- [ ] `.agentrc.json` `models` section updated with local model entry
- [ ] `agentModels` mapping configured for target agents
- [ ] `ModelSelector` integration tested — agents route to local model
- [ ] Quality comparison done — local vs cloud output for key tasks
- [ ] Latency and throughput acceptable for interactive use
- [ ] `npm run compile && npm test` passes
- [ ] Fallback to cloud model works when local endpoint is down
