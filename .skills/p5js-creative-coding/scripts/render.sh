#!/bin/bash
# p5.js 技能 — 无头渲染流水线
# 通过 Puppeteer + ffmpeg 将 p5.js 草图渲染为 MP4 视频
#
# 用法:
#   bash scripts/render.sh sketch.html output.mp4 [options]
#
# 选项:
#   --width    Canvas width (default: 1920)
#   --height   Canvas height (default: 1080)
#   --fps      Frames per second (default: 30)
#   --duration Duration in seconds (default: 10)
#   --quality  CRF value 0-51 (default: 18, lower = better)
#   --frames-only  Only export frames, skip MP4 encoding
#
# 示例:
#   bash scripts/render.sh sketch.html output.mp4
#   bash scripts/render.sh sketch.html output.mp4 --duration 30 --fps 60
#   bash scripts/render.sh sketch.html output.mp4 --width 3840 --height 2160

set -euo pipefail

# Defaults
WIDTH=1920
HEIGHT=1080
FPS=30
DURATION=10
CRF=18
FRAMES_ONLY=false

# Parse arguments
INPUT="${1:?Usage: render.sh <input.html> <output.mp4> [options]}"
OUTPUT="${2:?Usage: render.sh <input.html> <output.mp4> [options]}"
shift 2

while [[ $# -gt 0 ]]; do
  case $1 in
    --width) WIDTH="$2"; shift 2 ;;
    --height) HEIGHT="$2"; shift 2 ;;
    --fps) FPS="$2"; shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    --quality) CRF="$2"; shift 2 ;;
    --frames-only) FRAMES_ONLY=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

TOTAL_FRAMES=$((FPS * DURATION))
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAME_DIR=$(mktemp -d)

echo "=== p5.js 渲染流水线 ==="
echo "Input:      $INPUT"
echo "Output:     $OUTPUT"
echo "分辨率: ${WIDTH}x${HEIGHT}"
echo "FPS:        $FPS"
echo "Duration:   ${DURATION}s (${TOTAL_FRAMES} frames)"
echo "Quality:    CRF $CRF"
echo "Frame dir:  $FRAME_DIR"
echo ""

# Check dependencies
command -v node >/dev/null 2>&1 || { echo "错误: 需要 Node.js"; exit 1; }
if [ "$FRAMES_ONLY" = false ]; then
  command -v ffmpeg >/dev/null 2>&1 || { echo "错误: MP4 导出需要 ffmpeg"; exit 1; }
fi

# Step 1: Capture frames via Puppeteer
echo "步骤 1/2: 捕获 ${TOTAL_FRAMES} 帧..."
node "$SCRIPT_DIR/export-frames.js" \
  "$INPUT" \
  --output "$FRAME_DIR" \
  --width "$WIDTH" \
  --height "$HEIGHT" \
  --frames "$TOTAL_FRAMES" \
  --fps "$FPS"

echo "帧已捕获到 $FRAME_DIR"

if [ "$FRAMES_ONLY" = true ]; then
  echo "帧已保存到: $FRAME_DIR"
  echo "手动编码命令:"
  echo "  ffmpeg -framerate $FPS -i $FRAME_DIR/frame-%04d.png -c:v libx264 -crf $CRF -pix_fmt yuv420p $OUTPUT"
  exit 0
fi

# Step 2: Encode to MP4
echo "步骤 2/2: 编码 MP4..."
ffmpeg -y \
  -framerate "$FPS" \
  -i "$FRAME_DIR/frame-%04d.png" \
  -c:v libx264 \
  -preset slow \
  -crf "$CRF" \
  -pix_fmt yuv420p \
  -movflags +faststart \
  "$OUTPUT" \
  2>"$FRAME_DIR/ffmpeg.log"

# Cleanup
rm -rf "$FRAME_DIR"

# Report
FILE_SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
echo ""
echo "=== 完成 ==="
echo "输出: $OUTPUT ($FILE_SIZE)"
echo "时长: ${DURATION}秒 @ ${FPS}fps, ${WIDTH}x${HEIGHT}"
