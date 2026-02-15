#!/usr/bin/env bash
set -euo pipefail

# Quality Gates Runner — VS Code Agent
# Runs all quality gates in sequence. Exits non-zero on first failure.
# Usage: bash .github/skills/quality-gates/run-all.sh

PASS=0
FAIL=0
SKIP=0

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }
yellow(){ printf '\033[0;33m%s\033[0m\n' "$1"; }

run_gate() {
  local name="$1"
  shift
  printf '▶ %-30s' "$name"
  if "$@" > /dev/null 2>&1; then
    green "PASS"
    PASS=$((PASS + 1))
  else
    red "FAIL"
    FAIL=$((FAIL + 1))
    return 1
  fi
}

skip_gate() {
  local name="$1"
  local reason="$2"
  printf '▶ %-30s' "$name"
  yellow "SKIP ($reason)"
  SKIP=$((SKIP + 1))
}

echo "═══════════════════════════════════════════"
echo "  Quality Gates — VS Code Agent"
echo "═══════════════════════════════════════════"
echo ""

# Gate 1: Build
run_gate "Build (tsc)" npm run compile || true

# Gate 2: Lint
run_gate "Lint (ESLint)" npm run lint || true

# Gate 3: Unit Tests
run_gate "Unit Tests (Vitest)" npm test || true

# Gate 4: Security — npm audit
if command -v npm &> /dev/null; then
  run_gate "Dependency Audit" npm audit --omit=dev || true
else
  skip_gate "Dependency Audit" "npm not found"
fi

# Gate 5: Docker Build
if command -v docker &> /dev/null; then
  run_gate "Docker Build" docker build -t vscode-agent . || true
else
  skip_gate "Docker Build" "docker not found"
fi

# Gate 6: No secrets in code
run_gate "Secrets Scan" bash -c '! grep -rn "AKIA\|sk-[a-zA-Z0-9]\{20,\}\|ghp_[a-zA-Z0-9]\{36\}\|password\s*=\s*[\"'\''][^\"'\'']\+[\"'\'']" src/ --include="*.ts" 2>/dev/null' || true

# Gate 7: No TODO placeholders in production code
run_gate "No Placeholders" bash -c '! grep -rn "TODO:\|FIXME:\|HACK:\|XXX:" src/ --include="*.ts" -l 2>/dev/null | head -1 | grep -q .' || true

# Gate 8: TypeScript strict mode
run_gate "Strict Mode Check" bash -c 'grep -q "\"strict\": true" tsconfig.json' || true

echo ""
echo "═══════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed, ${SKIP} skipped"
echo "═══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  red "Some quality gates failed. Fix issues before proceeding."
  exit 1
else
  green "All quality gates passed."
  exit 0
fi
