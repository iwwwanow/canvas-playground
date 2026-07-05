#!/usr/bin/env bash
# mondrian-clip.sh — mondrian-фильтр для одного mp4-клипа
#
# Usage:
#   ./scripts/mondrian-clip.sh <clip.mp4> [output_dir]
#
# Аргументы:
#   clip.mp4      — исходный клип (обычно из batch-out/clips/)
#   output_dir    — куда сохранять результат (по умолчанию: batch-out/clips-mondrian)
#
# Выход: <output_dir>/<clipname>-mondrian.mp4
#
# Параметры mondrian (из planning.md):
#   frames: --fps 15 --tones 12 --hues 12 --min-region 32
#   render: --mode solid --color-palette D40920,1B3F8B,F5C000 --bg-color FFFFFF

set -e
cd "$(dirname "$0")/.."

INPUT="$1"
BASENAME=$(basename "$INPUT" .mp4)
OUT_DIR="${2:-batch-out/clips-mondrian}"
ASSETS="assets/downloaded"
TOAST="npx tsx packages/cli/src/index.ts"
SEGDIR="/tmp/mondrian-clip-segs/$BASENAME"

if [[ -z "$INPUT" ]]; then
  echo "Usage: $0 <clip.mp4> [output_dir]"
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Файл не найден: $INPUT"
  exit 1
fi

mkdir -p "$OUT_DIR" "$SEGDIR"

OUT_FILE="$OUT_DIR/${BASENAME}-mondrian.mp4"

if [[ -f "$OUT_FILE" && -s "$OUT_FILE" ]]; then
  echo "SKIP $(basename "$OUT_FILE") (уже есть)"
  exit 0
fi

echo "--- $(basename "$INPUT") ---"

echo "  сегментация..."
$TOAST mosaic frames \
  -i "$INPUT" -o "$SEGDIR" \
  --fps 15 --tones 12 --hues 12 --min-region 32 \
  2>&1 | tail -1

echo "  рендер..."
$TOAST mosaic render \
  --segments "$SEGDIR/segments.json" \
  --assets "$ASSETS" \
  -o "$OUT_FILE" \
  --mode solid \
  --color-palette D40920,1B3F8B,F5C000 \
  --bg-color FFFFFF \
  --scale 540 \
  --fps 15 \
  --format mp4 \
  --no-save-frames \
  2>&1 | tail -2

rm -rf "$SEGDIR"
echo "  → $OUT_FILE ($(du -sh "$OUT_FILE" | cut -f1))"
