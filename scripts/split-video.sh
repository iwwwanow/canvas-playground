#!/usr/bin/env bash
# split-video.sh — разбивка одного видео на короткие отрезки (540px)
#
# Usage:
#   ./scripts/split-video.sh <input.mp4> [output_dir] [segment_seconds]
#
# Аргументы:
#   input.mp4         — исходное видео
#   output_dir        — куда сохранять клипы (по умолчанию: batch-out/clips)
#   segment_seconds   — длина отрезка в секундах (по умолчанию: 3)
#
# Выход: batch-out/clips/<basename>-001.mp4, -002.mp4, ...

set -e
cd "$(dirname "$0")/.."

INPUT="$1"
BASENAME=$(basename "$INPUT" .mp4)
OUT_DIR="${2:-batch-out/clips}"
SEG_SECS="${3:-3}"

if [[ -z "$INPUT" ]]; then
  echo "Usage: $0 <input.mp4> [output_dir] [segment_seconds]"
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Файл не найден: $INPUT"
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "=== split: $(basename "$INPUT") → $OUT_DIR (${SEG_SECS}s, max 540px) ==="

ffmpeg -y -v quiet -i "$INPUT" \
  -vf "scale=min(iw\,540):-2" \
  -c:v libx264 -crf 23 -preset fast \
  -an \
  -f segment -segment_time "$SEG_SECS" -reset_timestamps 1 \
  "$OUT_DIR/${BASENAME}-%03d.mp4"

COUNT=$(ls "$OUT_DIR/${BASENAME}"-*.mp4 2>/dev/null | wc -l)
echo "  готово: $COUNT клипов → $OUT_DIR"
