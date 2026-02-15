# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source and compile
COPY tsconfig.json ./
COPY src/ src/

RUN npx tsc -p ./

# Prune devDependencies for smaller image
RUN npm prune --production 2>/dev/null || true

# ---------- Stage 2: Package ----------
FROM node:20-alpine AS packager

WORKDIR /app

# Install vsce and build VSIX
COPY --from=builder /app/ ./
COPY package.json ./
COPY README.md CHANGELOG.md LICENSE ./
COPY media/ media/

RUN npm install -g @vscode/vsce && \
    vsce package --no-dependencies -o /app/vscode-agent.vsix

# ---------- Stage 3: Output ----------
FROM alpine:3.19

LABEL org.opencontainers.image.title="vscode-agent" \
      org.opencontainers.image.description="VS Code Agent extension build" \
      org.opencontainers.image.source="https://github.com/ashsolei/vscode-agent" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /output

# Copy compiled output, VSIX, and package metadata
COPY --from=builder /app/out/ ./out/
COPY --from=builder /app/package.json ./
COPY --from=packager /app/vscode-agent.vsix ./

# No runtime process — this image is an artifact container.
# Extract the VSIX:  docker cp $(docker create vscode-agent):/output/vscode-agent.vsix .
CMD ["echo", "VSIX built. Use: docker cp $(docker create vscode-agent):/output/vscode-agent.vsix ."]
