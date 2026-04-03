#!/usr/bin/env bash
# render-batch2.sh — mondrian & viz на нескольких инпутах, небольшие вариации параметров
set -e
cd "$(dirname "$0")/.."

ASSETS="assets/downloaded"
SEGS="batch-out/new-inputs/segments"
OUT="batch-out/new-inputs/renders"
TOAST="npx tsx packages/cli/src/index.ts"
MONDRIAN="--viz-mode --color-palette D40920,1B3F8B,F5C000 --bg-color FFFFFF"

mkdir -p "$OUT"

segment() {
  local name="$1" input="$2" fps="$3" mr="$4" tones="$5" hues="$6"
  echo "  segmenting $name (mr=$mr t=$tones h=$hues)..."
  $TOAST mosaic frames -i "$input" -o "$SEGS/$name" \
    --fps "$fps" --min-region "$mr" --tones "$tones" --hues "$hues" 2>&1 | tail -1
}

render() {
  local name="$1" seg="$2" out="$3"; shift 3
  local extra="$@"
  if [[ -f "$OUT/$out" ]]; then echo "SKIP $out"; return; fi
  echo "  rendering $out..."
  $TOAST mosaic render \
    --segments "$SEGS/$seg/segments.json" \
    --assets "$ASSETS" \
    -o "$OUT/$out" \
    --format gif --no-save-frames $extra
}

# ═══════════════════════════════════════════════════════════════
echo "━━ test-6  390×450  65f@20fps ━━"
segment input-test-6 batch-out/new-inputs/input-test-6.gif 20 32 12 12
render _ input-test-6 test6-viz-mr32-t12-h12.gif        --mode solid --scale 420
render _ input-test-6 test6-mondrian-mr32-t12-h12.gif   --scale 420 $MONDRIAN

# чуть грубее — mr64, дает крупные формы
segment input-test-6-mr64 batch-out/new-inputs/input-test-6.gif 20 64 12 12
render _ input-test-6-mr64 test6-viz-mr64-t12-h12.gif   --mode solid --scale 420

# ═══════════════════════════════════════════════════════════════
echo "━━ test-7  350×250  52f@11fps ━━"
segment input-test-7 batch-out/new-inputs/input-test-7.gif 11 32 12 12
render _ input-test-7 test7-viz-mr32-t12-h12.gif        --mode solid --scale 420
render _ input-test-7 test7-mondrian-mr32-t12-h12.gif   --scale 420 $MONDRIAN

# чуть мельче — mr16
segment input-test-7-mr16 batch-out/new-inputs/input-test-7.gif 11 16 12 12
render _ input-test-7-mr16 test7-viz-mr16-t12-h12.gif   --mode solid --scale 420

# ═══════════════════════════════════════════════════════════════
echo "━━ test-8  375×358  14f@10fps ━━"
segment input-test-8 batch-out/new-inputs/input-test-8.gif 10 32 12 12
render _ input-test-8 test8-viz-mr32-t12-h12.gif        --mode solid --scale 420
render _ input-test-8 test8-mondrian-mr32-t12-h12.gif   --scale 420 $MONDRIAN

# ═══════════════════════════════════════════════════════════════
echo "━━ new-input-3  480×480  video ━━"
segment new-input-3 batch-out/new-inputs/new-input-3.mp4 10 32 12 12
render _ new-input-3 new3-viz-mr32-t12-h12.gif          --mode solid --duration 3 --fps 10 --scale 420
render _ new-input-3 new3-mondrian-mr32-t12-h12.gif     --duration 3 --fps 10 --scale 420 $MONDRIAN

# ═══════════════════════════════════════════════════════════════
echo "━━ new-input-1  648×1280  video (portrait) ━━"
segment new-input-1 batch-out/new-inputs/new-input-1.mp4 10 32 12 12
render _ new-input-1 new1-viz-mr32-t12-h12.gif          --mode solid --duration 3 --fps 10 --scale 360
render _ new-input-1 new1-mondrian-mr32-t12-h12.gif     --duration 3 --fps 10 --scale 360 $MONDRIAN

echo ""
echo "Done → $OUT"
ls -1 "$OUT"/*.gif | wc -l && echo "GIFs total"
