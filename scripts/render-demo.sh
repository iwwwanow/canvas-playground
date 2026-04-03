#!/usr/bin/env bash
# render-demo.sh — comprehensive GIF demo for all new-inputs
# Demonstrates every major mosaic feature across all 8 inputs

set -e
cd "$(dirname "$0")/.."

ASSETS="assets/downloaded"
SEGS="batch-out/new-inputs/segments"
OUT="batch-out/new-inputs/renders"
TOAST="npx tsx packages/cli/src/index.ts"

# Image settings (animated webp → gif → segments, native motion)
IMG_OPTS="--duration 3 --fps 12 --format gif --scale 420 --no-save-frames"
# Video settings (clip to 3s)
VID_OPTS="--duration 3 --fps 10 --format gif --scale 360 --no-save-frames"

render() {
  local name="$1"; shift
  local seg_dir="$1"; shift
  local extra_opts="$@"
  local out_path="$OUT/${name}.gif"
  if [[ -f "$out_path" ]]; then
    echo "SKIP (exists): $out_path"
    return
  fi
  echo ""
  echo "━━ $name ━━"
  $TOAST mosaic render \
    --segments "$SEGS/$seg_dir/segments.json" \
    --assets "$ASSETS" \
    -o "$out_path" \
    $extra_opts
}

mkdir -p "$OUT"

# ══════════════════════════════════════════════════════════════
# test-5  327×338  40 frames @ 25fps
# ══════════════════════════════════════════════════════════════
render test5-solid          input-test-5  --mode solid              $IMG_OPTS
render test5-photo          input-test-5  --mode photo              $IMG_OPTS
render test5-gradmap        input-test-5  --gradient-map            $IMG_OPTS
render test5-blur           input-test-5  --blur-tiles              $IMG_OPTS

# ══════════════════════════════════════════════════════════════
# test-6  390×450  65 frames @ 20fps
# ══════════════════════════════════════════════════════════════
render test6-solid          input-test-6  --mode solid              $IMG_OPTS
render test6-photo          input-test-6  --mode photo              $IMG_OPTS
render test6-hue            input-test-6  --hue-tiles               $IMG_OPTS
render test6-gradmap        input-test-6  --gradient-map            $IMG_OPTS

# ══════════════════════════════════════════════════════════════
# test-7  350×250  52 frames @ 11fps
# ══════════════════════════════════════════════════════════════
render test7-solid          input-test-7  --mode solid              $IMG_OPTS
render test7-photo          input-test-7  --mode photo              $IMG_OPTS
render test7-tint           input-test-7  --tint-tiles --tint-strength 0.5  $IMG_OPTS
render test7-hue            input-test-7  --hue-tiles               $IMG_OPTS
render test7-blur           input-test-7  --blur-tiles              $IMG_OPTS

# ══════════════════════════════════════════════════════════════
# test-8  375×358  14 frames @ 10fps
# ══════════════════════════════════════════════════════════════
render test8-solid          input-test-8  --mode solid              $IMG_OPTS
render test8-photo          input-test-8  --mode photo              $IMG_OPTS
render test8-tint           input-test-8  --tint-tiles --tint-strength 0.5  $IMG_OPTS
render test8-gradmap        input-test-8  --gradient-map            $IMG_OPTS
render test8-hue            input-test-8  --hue-tiles               $IMG_OPTS
render test8-blur           input-test-8  --blur-tiles              $IMG_OPTS
render test8-maxtile64      input-test-8  --max-tile 64             $IMG_OPTS

# ══════════════════════════════════════════════════════════════
# test-9  475×278  16 frames @ 25fps
# ══════════════════════════════════════════════════════════════
render test9-solid          input-test-9  --mode solid              $IMG_OPTS
render test9-photo          input-test-9  --mode photo              $IMG_OPTS
render test9-tint           input-test-9  --tint-tiles --tint-strength 0.5  $IMG_OPTS
render test9-gradmap        input-test-9  --gradient-map            $IMG_OPTS
render test9-hue            input-test-9  --hue-tiles               $IMG_OPTS
render test9-blur           input-test-9  --blur-tiles              $IMG_OPTS
render test9-maxtile64      input-test-9  --max-tile 64             $IMG_OPTS

# ══════════════════════════════════════════════════════════════
# new-input-1  648×1280  96 frames @ 10fps
# ══════════════════════════════════════════════════════════════
render new1-solid           new-input-1  --mode solid               $VID_OPTS
render new1-photo           new-input-1  --mode photo               $VID_OPTS
render new1-tint            new-input-1  --tint-tiles --tint-strength 0.5  $VID_OPTS
render new1-gradmap         new-input-1  --gradient-map             $VID_OPTS
render new1-hue             new-input-1  --hue-tiles                $VID_OPTS
render new1-blur            new-input-1  --blur-tiles               $VID_OPTS
render new1-maxtile64       new-input-1  --max-tile 64              $VID_OPTS
render new1-boost           new-input-1  --boost-tiles              $VID_OPTS

# ══════════════════════════════════════════════════════════════
# new-input-2  720×1280  trim to 3s
# ══════════════════════════════════════════════════════════════
render new2-solid           new-input-2  --mode solid               $VID_OPTS
render new2-photo           new-input-2  --mode photo               $VID_OPTS
render new2-tint            new-input-2  --tint-tiles --tint-strength 0.5  $VID_OPTS
render new2-gradmap         new-input-2  --gradient-map             $VID_OPTS
render new2-hue             new-input-2  --hue-tiles                $VID_OPTS
render new2-blur            new-input-2  --blur-tiles               $VID_OPTS
render new2-maxtile64       new-input-2  --max-tile 64              $VID_OPTS
render new2-boost           new-input-2  --boost-tiles              $VID_OPTS

# ══════════════════════════════════════════════════════════════
# new-input-3  480×480  trim to 3s
# ══════════════════════════════════════════════════════════════
render new3-solid           new-input-3  --mode solid               $VID_OPTS
render new3-photo           new-input-3  --mode photo               $VID_OPTS
render new3-tint            new-input-3  --tint-tiles --tint-strength 0.5  $VID_OPTS
render new3-gradmap         new-input-3  --gradient-map             $VID_OPTS
render new3-hue             new-input-3  --hue-tiles                $VID_OPTS
render new3-blur            new-input-3  --blur-tiles               $VID_OPTS
render new3-maxtile64       new-input-3  --max-tile 64              $VID_OPTS
render new3-boost           new-input-3  --boost-tiles              $VID_OPTS

echo ""
echo "All renders done → $OUT"
ls -1 "$OUT"/*.gif | wc -l
echo "GIFs total"
