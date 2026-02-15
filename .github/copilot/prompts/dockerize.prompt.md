````prompt
---
mode: "agent"
description: "Create or optimize Docker setup — multi-stage build, minimize image size, extract VSIX artifact, CI integration"
---

# Dockerize

You are a containerization engineer for the VS Code Agent extension (TypeScript, zero runtime deps, vsce packaging). You will create or optimize the Docker build to produce a minimal VSIX artifact.

## Workflow

1. **Review the existing Dockerfile**:
   ```bash
   cat Dockerfile
   cat .dockerignore
   ```

2. **Optimize multi-stage build**:
   ```dockerfile
   # Stage 1: Build
   FROM node:20-slim AS builder
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci --ignore-scripts
   COPY tsconfig.json ./
   COPY src/ src/
   RUN npm run compile
   RUN npm run lint
   RUN npm test
   RUN npx vsce package --no-dependencies

   # Stage 2: Extract artifact
   FROM scratch AS artifact
   COPY --from=builder /app/*.vsix /
   ```

3. **Create/update `.dockerignore`**: Exclude `node_modules`, `.git`, `out/`, `*.vsix`, `.vscode/`, `coverage/`, `.github/`.

4. **Build and extract VSIX**:
   ```bash
   docker build -t vscode-agent .
   # Extract VSIX from the image
   docker build --target artifact --output type=local,dest=./dist .
   ```

5. **Optimize image size**:
   - Use `node:20-slim` (not `node:20`) as base — ~200MB smaller.
   - Use `npm ci --ignore-scripts` to skip lifecycle scripts.
   - Don't copy `devDependencies` to final stage — the VSIX is self-contained.
   - Multi-stage ensures build tools aren't in the output.

6. **Integrate with CI**:
   ```yaml
   - name: Build VSIX via Docker
     run: docker build --target artifact --output type=local,dest=./dist .
   - uses: actions/upload-artifact@v4
     with:
       name: vsix
       path: dist/*.vsix
   ```

7. **Validate**:
   ```bash
   docker build -t vscode-agent . --no-cache
   ls -lh dist/*.vsix  # Verify VSIX exists and is reasonably sized
   ```

## Quality Checklist
- [ ] Multi-stage build separates build from artifact
- [ ] `.dockerignore` excludes unnecessary files
- [ ] `node:20-slim` used as base image
- [ ] `npm ci` used for deterministic installs
- [ ] Tests run inside the build stage (fail-fast)
- [ ] VSIX extractable via `--output` or `docker cp`
- [ ] Final image/artifact contains only the VSIX

## Pitfalls to Avoid
- Don't use `node:latest` — pin the major version
- Don't copy `node_modules` from host — always `npm ci` inside the container
- Don't skip tests in the Docker build — catch failures before packaging
- Don't forget `--no-dependencies` flag for `vsce package`
- Don't leave the build stage as the default target — use `scratch` for artifact-only output
````
