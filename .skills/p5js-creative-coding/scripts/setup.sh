#!/bin/bash
# p5.js 技能 — 依赖检查
# 运行: bash scripts/setup.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }

echo "=== p5.js 技能 — 环境检查 ==="
echo ""

# Required: Node.js (for Puppeteer headless export)
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  ok "Node.js $NODE_VER"
else
  warn "未找到 Node.js — 可选，无头导出需要"
  echo "  Install: https://nodejs.org/ or 'brew install node'"
fi

# Required: npm (for Puppeteer install)
if command -v npm &>/dev/null; then
  NPM_VER=$(npm -v)
  ok "npm $NPM_VER"
else
  warn "未找到 npm — 可选，无头导出需要"
fi

# Optional: Puppeteer
if node -e "require('puppeteer')" 2>/dev/null; then
  ok "Puppeteer installed"
else
  warn "未安装 Puppeteer — 无头导出需要"
  echo "  Install: npm install puppeteer"
fi

# Optional: ffmpeg (for MP4 encoding from frame sequences)
if command -v ffmpeg &>/dev/null; then
  FFMPEG_VER=$(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')
  ok "ffmpeg $FFMPEG_VER"
else
  warn "未找到 ffmpeg — MP4 导出需要"
  echo "  Install: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)"
fi

# Optional: Python3 (for local server)
if command -v python3 &>/dev/null; then
  PY_VER=$(python3 --version 2>&1 | awk '{print $2}')
  ok "Python $PY_VER (本地服务器: python3 -m http.server)"
else
  warn "未找到 Python3 — 本地文件服务需要"
fi

# Browser check (macOS)
if [[ "$(uname)" == "Darwin" ]]; then
  if open -Ra "Google Chrome" 2>/dev/null; then
    ok "找到 Google Chrome"
  elif open -Ra "Safari" 2>/dev/null; then
    ok "找到 Safari"
  else
    warn "未检测到浏览器"
  fi
fi

echo ""
echo "=== 核心需求 ==="
echo "  A modern browser (Chrome/Firefox/Safari/Edge)"
echo "  p5.js loaded via CDN — no local install needed"
echo ""
echo "=== 可选 (用于导出) ==="
echo "  Node.js + Puppeteer — headless frame capture"
echo "  ffmpeg — frame sequence to MP4"
echo "  Python3 — local development server"
echo ""
echo "=== 快速开始 ==="
echo "  1. Create an HTML file with inline p5.js sketch"
echo "  2. Open in browser: open sketch.html"
echo "  3. Press 's' to save PNG, 'g' to save GIF"
echo ""
echo "环境检查完成。"
