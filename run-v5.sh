#!/bin/bash
set -e
cd /home/ubuntu-operator/Projects/iwwwanow_xtc-toaster

echo "=== [1/3] Downloading 140 more flower assets (320×320) ==="
npx tsx packages/cli/src/index.ts mosaic collect-assets \
  --count 140 \
  --query flowers \
  -o assets/downloaded/photos/flowers-small

echo ""
echo "=== [2/3] Re-segmenting with higher granularity (tones=10 hues=12 min-region=80) ==="
npx tsx packages/cli/src/index.ts mosaic frames \
  -i assets/input/input-timelapse-clip.mp4 \
  -o batch-out/run-v5-frames \
  --fps 12 \
  --tones 10 \
  --hues 12 \
  --min-region 80

echo ""
echo "=== [3/3] Rendering mosaic (200 assets, chunked composite) ==="
npx tsx packages/cli/src/index.ts mosaic render \
  --segments batch-out/run-v5-frames/segments.json \
  --assets assets/downloaded/photos \
  -o batch-out/run-v5.mp4 \
  --duration 10 \
  --fps 12 \
  --format mp4

echo ""
echo "=== Done! batch-out/run-v5.mp4 ==="
