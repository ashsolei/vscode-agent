---
name: "Docker Build Release"
description: "Docker multi-stage build for VSIX packaging: build stage (npm ci, compile, test, package), release stage (extract VSIX artifact)"
argument-hint: "Build target or 'release'"
---

# Docker Build Release

Build and release the VS Code Agent extension as a VSIX artifact using the multi-stage Dockerfile at the project root. The build produces a zero-dependency VSIX suitable for distribution.

## Workflow

1. **Review** `Dockerfile` — three stages: builder, packager, output.
2. **Build** the Docker image: `docker build -t vscode-agent .`
3. **Extract** the VSIX: `docker cp $(docker create vscode-agent):/output/vscode-agent.vsix .`
4. **Validate** — install the VSIX locally and run the health check command.
5. **Tag** — apply a git tag matching the version in `package.json`.

## Dockerfile Stages

| Stage | Base | Purpose |
|-------|------|---------|
| `builder` | `node:20-alpine` | `npm ci`, `npx tsc -p ./`, prune devDependencies |
| `packager` | `node:20-alpine` | Install `@vscode/vsce`, run `vsce package --no-dependencies` |
| `output` | `alpine:3.19` | Artifact container — holds compiled `out/`, `package.json`, VSIX |

## Templates

### Build and extract VSIX

```bash
# Full build
docker build -t vscode-agent .

# Create a temporary container and copy out the artifact
CID=$(docker create vscode-agent)
docker cp "$CID":/output/vscode-agent.vsix ./vscode-agent.vsix
docker rm "$CID"
```

### Build with build args or cache

```bash
# Use BuildKit for better caching
DOCKER_BUILDKIT=1 docker build \
  --cache-from vscode-agent:latest \
  -t vscode-agent:$(git rev-parse --short HEAD) .
```

### Validate the VSIX

```bash
# Install locally
code --install-extension ./vscode-agent.vsix

# Or inspect contents
unzip -l vscode-agent.vsix | head -30
```

### CI integration (GitHub Actions)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t vscode-agent .
      - run: |
          CID=$(docker create vscode-agent)
          docker cp "$CID":/output/vscode-agent.vsix .
          docker rm "$CID"
      - uses: actions/upload-artifact@v4
        with:
          name: vscode-agent-vsix
          path: vscode-agent.vsix
```

## Rules

- The extension has **zero runtime dependencies** — `vsce package --no-dependencies` is correct.
- `npm ci --ignore-scripts` is used in the builder stage for reproducible installs.
- The output stage has no Node.js runtime — it is an artifact-only container.
- Always match the Node version in Dockerfile to the CI matrix (Node 20).
- Version in the VSIX comes from `package.json` `version` field (currently `0.1.0`).
- OCI labels in the Dockerfile must reference the correct GitHub repository URL.
- The `media/` directory must be copied into the packager stage for the extension icon.
- `README.md`, `CHANGELOG.md`, and `LICENSE` are required by `vsce package`.

## Checklist

- [ ] `docker build -t vscode-agent .` completes without errors
- [ ] VSIX extracted successfully from the output container
- [ ] VSIX contains `out/extension.js` and all compiled agent files
- [ ] `package.json` version matches the intended release version
- [ ] No runtime `dependencies` present — only `devDependencies`
- [ ] Git tag created: `git tag v$(node -p "require('./package.json').version")`
- [ ] VSIX installs and activates in VS Code ^1.93.0
- [ ] Health check command (`Agent: Health Check`) runs successfully
