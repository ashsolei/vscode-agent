# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run compile

# Stage 2: Package
FROM node:20-alpine AS packager

WORKDIR /app

COPY --from=builder /app/out ./out
COPY --from=builder /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY README.md LICENSE CHANGELOG.md ./
COPY media/ ./media/

RUN npm prune --production 2>/dev/null; exit 0

# Stage 3: Final
FROM node:20-alpine

LABEL org.opencontainers.image.title="VS Code Agent" \
      org.opencontainers.image.description="A modular multi-agent system for VS Code Chat" \
      org.opencontainers.image.source="https://github.com/ashsolei/vscode-agent" \
      org.opencontainers.image.license="MIT"

WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=packager --chown=appuser:appgroup /app ./

USER appuser

CMD ["node", "out/extension.js"]
