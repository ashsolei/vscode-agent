---
mode: "agent"
description: "Create and configure CI/CD pipelines — GitHub Actions workflows for build, test, lint, package, and release"
---

# CI/CD Pipeline Configuration

Create or update GitHub Actions workflows for the VS Code Agent extension.

## Current CI Setup

File: `.github/workflows/ci.yml`
- Matrix: Node.js 18 and 20
- Steps: checkout → setup-node → npm ci → compile → lint → test
- Runs on: push/PR to main

## Pipeline Template

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run compile
      - run: npm run lint
      - run: npm test
```

## Release Pipeline

```yaml
  release:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run package
      - uses: actions/upload-artifact@v4
        with:
          name: vsix
          path: '*.vsix'
```

## Rules

- Always test on Node 18 AND 20 (matrix)
- Run compile before lint before test (dependency order)
- Use `npm ci` not `npm install` in CI
- Package with `npm run package` (runs `vsce package --no-dependencies`)
- Cache npm dependencies for faster builds
- Docker build: `docker build -t vscode-agent .` (multi-stage, outputs VSIX)
