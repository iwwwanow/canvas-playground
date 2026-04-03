#!/usr/bin/env bash
# split-batch.sh — разбивка всех видео из директории на отрезки случайной длины
#
# Usage:
#   ./scripts/split-batch.sh [inputs_dir] [output_dir] [min_sec] [max_sec]
#
# Аргументы:
#   inputs_dir    — директория с исходными mp4 (по умолчанию: batch-out/inputs)
#   output_dir    — куда сохранять клипы (по умолчанию: batch-out/clips)
#   min_sec       — минимальная длина отрезка (по умолчанию: 1)
#   max_sec       — максимальная длина отрезка (по умолчанию: 5)

set -e
cd "$(dirname "$0")/.."

INPUTS_DIR="${1:-batch-out/inputs}"
OUT_DIR="${2:-batch-out/clips}"
MIN_SEC="${3:-1}"
MAX_SEC="${4:-5}"

if [[ ! -d "$INPUTS_DIR" ]]; then
  echo "Директория не найдена: $INPUTS_DIR"
  exit 1
fi

mkdir -p "$OUT_DIR"

VIDEOS=("$INPUTS_DIR"/*.mp4)
TOTAL=${#VIDEOS[@]}

echo "=== split batch: $TOTAL видео из $INPUTS_DIR (случайные ${MIN_SEC}–${MAX_SEC}s, max 540px) ==="
echo ""

for VID in "${VIDEOS[@]}"; do
  [[ -f "$VID" ]] || continue
  bash "$(dirname "$0")/split-video.sh" "$VID" "$OUT_DIR" "$MIN_SEC" "$MAX_SEC"
  echo ""
done

echo "=== Готово ==="
TOTAL_CLIPS=$(ls "$OUT_DIR"/*.mp4 2>/dev/null | wc -l)
echo "Всего клипов: $TOTAL_CLIPS → $OUT_DIR"
