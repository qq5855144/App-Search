#!/bin/bash
# p5.js 技能 — 本地开发服务器
# 通过 HTTP 服务当前目录，用于加载本地资源 (字体、图片)
#
# 用法:
#   bash scripts/serve.sh [port] [directory]
#
# 示例:
#   bash scripts/serve.sh                    # serve CWD on port 8080
#   bash scripts/serve.sh 3000               # serve CWD on port 3000
#   bash scripts/serve.sh 8080 ./my-project  # serve specific directory

PORT="${1:-8080}"
DIR="${2:-.}"

echo "=== p5.js 开发服务器 ==="
echo "服务目录: $(cd "$DIR" && pwd)"
echo "URL:     http://localhost:$PORT"
echo "按 Ctrl+C 停止"
echo ""

cd "$DIR" && python3 -m http.server "$PORT" 2>/dev/null || {
  echo "未找到 Python3，尝试 Node.js..."
  npx serve -l "$PORT" "$DIR" 2>/dev/null || {
    echo "错误: 需要 python3 或 npx (Node.js) 来启动本地服务器"
    exit 1
  }
}
