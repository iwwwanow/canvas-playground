#!/usr/bin/env bash
# split-video.sh — разбивка одного видео на отрезки случайной длины (1–5 сек, max 540px)
#
# Usage:
#   ./scripts/split-video.sh <input.mp4> [output_dir] [min_sec] [max_sec]
#
# Аргументы:
#   input.mp4     — исходное видео
#   output_dir    — куда сохранять клипы (по умолчанию: batch-out/clips)
#   min_sec       — минимальная длина отрезка в секундах (по умолчанию: 1)
#   max_sec       — максимальная длина отрезка в секундах (по умолчанию: 5)
#
# Выход: <output_dir>/<basename>-001.mp4, -002.mp4, ...

set -e
cd "$(dirname "$0")/.."

INPUT="$1"
BASENAME=$(basename "$INPUT" .mp4)
OUT_DIR="${2:-batch-out/clips}"
MIN_SEC="${3:-1}"
MAX_SEC="${4:-5}"

if [[ -z "$INPUT" ]]; then
  echo "Usage: $0 <input.mp4> [output_dir] [min_sec] [max_sec]"
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Файл не найден: $INPUT"
  exit 1
fi

mkdir -p "$OUT_DIR"

# Общая длительность видео в секундах (целая часть)
DURATION=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$INPUT" | cut -d. -f1)

echo "=== split: $(basename "$INPUT") (${DURATION}s) → $OUT_DIR (случайные ${MIN_SEC}–${MAX_SEC}s, max 540px) ==="

IDX=0
START=0

while [[ "$START" -lt "$DURATION" ]]; do
  # Случайная длина от MIN_SEC до MAX_SEC
  SEG_LEN=$(( RANDOM % (MAX_SEC - MIN_SEC + 1) + MIN_SEC ))

  # Не выходим за конец видео
  REMAINING=$(( DURATION - START ))
  if [[ "$REMAINING" -le 0 ]]; then
    break
  fi
  if [[ "$SEG_LEN" -gt "$REMAINING" ]]; then
    # Последний хвост: берём только если ≥ MIN_SEC
    if [[ "$REMAINING" -lt "$MIN_SEC" ]]; then
      break
    fi
    SEG_LEN="$REMAINING"
  fi

  OUT_FILE="$OUT_DIR/${BASENAME}-$(printf '%03d' $IDX).mp4"

  ffmpeg -y -v quiet \
    -ss "$START" -i "$INPUT" \
    -t "$SEG_LEN" \
    -vf "scale=min(iw\,540):-2" \
    -c:v libx264 -crf 23 -preset fast \
    -an \
    "$OUT_FILE"

  echo "  [$(printf '%03d' $IDX)] ${START}s + ${SEG_LEN}s → $(basename "$OUT_FILE")"

  START=$(( START + SEG_LEN ))
  IDX=$(( IDX + 1 ))
done

echo "  готово: $IDX клипов → $OUT_DIR"
