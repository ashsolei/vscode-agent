# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run compile

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/out ./out
COPY media/ ./media/
COPY README.md LICENSE CHANGELOG.md ./

ENV NODE_ENV=production

LABEL org.opencontainers.image.source="https://github.com/ashsolei/vscode-agent"
LABEL org.opencontainers.image.description="VS Code Agent - A modular multi-agent system for VS Code Chat"
LABEL org.opencontainers.image.licenses="MIT"

CMD ["node", "out/extension.js"]
