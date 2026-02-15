---
mode: "agent"
description: "Set up a local model for offline capability — select, quantize, deploy via Ollama/vLLM, benchmark on agent tasks, integrate with ModelSelector"
---

# Local Model Setup for Offline Capability

You are a local-AI deployment engineer for the VS Code Agent extension (TypeScript, VS Code ^1.93.0, 30+ agents extending BaseAgent, zero runtime deps, ModelSelector).

## Steps

1. **Select a local model**
   - Choose a model suited to coding tasks (e.g., CodeLlama, DeepSeek-Coder, Mistral, Phi).
   - Consider VRAM/RAM constraints — target quantized variants (Q4_K_M, Q5_K_S).
   - Verify the model can handle agent prompt sizes in `src/prompts/system-prompts.ts`.

2. **Deploy via Ollama or vLLM**
   ```bash
   ollama pull codellama:13b-instruct-q4_K_M && ollama serve
   curl http://localhost:11434/api/tags
   ```
   - Ensure the server exposes an OpenAI-compatible API endpoint.
   - Document the deployment in `README.md` under a "Local Models" section.

3. **Integrate with ModelSelector**
   - Update `src/models/model-selector.ts` to add a `local` model provider option.
   - Add `.agentrc.json` config for local model endpoint URL and model name.
   - Implement connectivity check — fall back to cloud model if local server is unreachable.

4. **Benchmark on agent tasks**
   - Select 5+ representative agent prompts (code, review, explain, debug, refactor).
   - Run each through the local model and measure: response quality, latency, token throughput.
   - Compare against cloud model baselines from `src/telemetry/`.
   ```bash
   npm run compile && npm test
   ```

5. **Configure routing rules**
   - Route latency-tolerant agents (e.g., `docgen`, `explain`) to local model.
   - Keep quality-critical agents (e.g., `security`, `architect`) on cloud models.
   - Update `.agentrc.json` `models{}` with routing overrides.

6. **Test offline scenario**
   - Disconnect network, verify routed agents still function via local model.
   - Verify non-routed agents show graceful error messages.
   - Run `npm run compile && npm test` with mocked local endpoints.

## Quality Checklist
- [ ] Zero new runtime dependencies in the extension itself
- [ ] ModelSelector routes correctly to local model when available
- [ ] Graceful fallback to cloud when local server is unreachable
- [ ] `.agentrc.json` documents local model configuration fields

## Pitfalls to Avoid
- Adding a local model SDK as a runtime dependency — use HTTP fetch only.
- Routing quality-critical agents to a small quantized model without benchmarking.
- Hardcoding `localhost:11434` — make the endpoint configurable via `.agentrc.json`.
- Forgetting to handle the case where the local server is slow to start.
- Not testing with the actual quantized model — quantization can degrade code quality.
