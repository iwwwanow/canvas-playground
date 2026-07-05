#!/usr/bin/env bash
# render-mondrian-batch.sh — mondrian render для всех видео
# Стратегия:
#   - Короткие видео (≤400s): сегментируем всё видео при 5fps
#   - Длинные видео (>400s): берём первые 90s (достаточно для reel)
#   - Рендер без --scale, потом ffmpeg scale до 540px
#   - viz-mode (mondrian) для solid

set -e
cd "$(dirname "$0")/.."

INPUTS="batch-out/inputs"
OUT="batch-out/reels/mondrian-renders"
ASSETS="assets/downloaded"
TOAST="npx tsx packages/cli/src/index.ts"
MONDRIAN="--viz-mode --color-palette D40920,1B3F8B,F5C000 --bg-color FFFFFF"
SEGBASE="/tmp/mondrian-segs"

mkdir -p "$OUT" "$SEGBASE"

render_video() {
  local VN="$1"      # номер видео (3, 5, 7, ...)
  local INPUT="$INPUTS/video-${VN}.mp4"
  local SEGDIR="$SEGBASE/v${VN}"
  local OUT_NATIVE="/tmp/mondrian-v${VN}-native.mp4"
  local OUT_FINAL="$OUT/mondrian-v${VN}.mp4"

  if [[ -f "$OUT_FINAL" && -s "$OUT_FINAL" ]]; then
    echo "SKIP $OUT_FINAL (уже есть)"
    return
  fi

  local DUR
  DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$INPUT" | cut -d. -f1)

  # Длинные видео — берём первые 90s
  local RENDER_DUR="$DUR"
  local CLIP_INPUT="$INPUT"
  if [[ "$DUR" -gt 400 ]]; then
    RENDER_DUR=90
    CLIP_INPUT="/tmp/mondrian-clip-v${VN}.mp4"
    if [[ ! -f "$CLIP_INPUT" ]]; then
      echo "  [v${VN}] нарезка первых 90s..."
      ffmpeg -y -v quiet -i "$INPUT" -t 90 -c copy "$CLIP_INPUT"
    fi
  fi

  mkdir -p "$SEGDIR"

  echo ""
  echo "=== video-${VN} (${DUR}s, рендерим ${RENDER_DUR}s) ==="

  if [[ ! -f "$SEGDIR/segments.json" ]]; then
    echo "  [v${VN}] сегментация при 5fps..."
    $TOAST mosaic frames \
      -i "$CLIP_INPUT" -o "$SEGDIR" \
      --fps 5 --tones 12 --hues 12 --min-region 32 2>&1 | tail -1
  else
    echo "  [v${VN}] segments.json уже есть ($(du -sh "$SEGDIR/segments.json" | cut -f1))"
  fi

  echo "  [v${VN}] рендер при нативном разрешении..."
  $TOAST mosaic render \
    --segments "$SEGDIR/segments.json" --assets "$ASSETS" \
    -o "$OUT_NATIVE" \
    --duration "$RENDER_DUR" --fps 15 --format mp4 --mode solid \
    $MONDRIAN \
    --no-save-frames 2>&1 | tail -2

  echo "  [v${VN}] scale → 540px..."
  ffmpeg -y -v quiet -i "$OUT_NATIVE" -vf "scale=540:-2" -c:v libx264 -pix_fmt yuv420p "$OUT_FINAL"
  rm -f "$OUT_NATIVE"

  echo "  [v${VN}] готово → $OUT_FINAL ($(du -sh "$OUT_FINAL" | cut -f1))"
}

# Короткие/средние: полный рендер
render_video 3   # 540×360, 393s
render_video 5   # 500×720, 127s
render_video 7   # 320×240, 286s

# Длинные: первые 90s
render_video 4   # 854×480, 1949s
render_video 9   # 540×360, 2267s
render_video 6   # 652×480, 4130s

echo ""
echo "=== Готово ==="
ls -lh "$OUT"/mondrian-v*.mp4
