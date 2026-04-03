#!/usr/bin/env bash
# split-batch.sh — разбивка всех видео из директории на короткие отрезки
#
# Usage:
#   ./scripts/split-batch.sh [inputs_dir] [output_dir] [segment_seconds]
#
# Аргументы:
#   inputs_dir        — директория с исходными mp4 (по умолчанию: batch-out/inputs)
#   output_dir        — куда сохранять клипы (по умолчанию: batch-out/clips)
#   segment_seconds   — длина отрезка в секундах (по умолчанию: 3)

set -e
cd "$(dirname "$0")/.."

INPUTS_DIR="${1:-batch-out/inputs}"
OUT_DIR="${2:-batch-out/clips}"
SEG_SECS="${3:-3}"

if [[ ! -d "$INPUTS_DIR" ]]; then
  echo "Директория не найдена: $INPUTS_DIR"
  exit 1
fi

mkdir -p "$OUT_DIR"

VIDEOS=("$INPUTS_DIR"/*.mp4)
TOTAL=${#VIDEOS[@]}

echo "=== split batch: $TOTAL видео из $INPUTS_DIR (${SEG_SECS}s, max 540px) ==="
echo ""

for VID in "${VIDEOS[@]}"; do
  [[ -f "$VID" ]] || continue
  bash "$(dirname "$0")/split-video.sh" "$VID" "$OUT_DIR" "$SEG_SECS"
  echo ""
done

echo "=== Готово ==="
TOTAL_CLIPS=$(ls "$OUT_DIR"/*.mp4 2>/dev/null | wc -l)
echo "Всего клипов: $TOTAL_CLIPS → $OUT_DIR"
