#!/usr/bin/env node
/**
 * Generate synthetic tiles for specific missing hue×tone cells.
 * Saves to assets/downloaded/photos/synthetic-gaps/
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.resolve("assets/downloaded/photos/synthetic-gaps");
const SIZE = 320;
const VARIANTS = 8;  // more variants per cell to ensure they land in the right bucket

fs.mkdirSync(OUT_DIR, { recursive: true });

// Missing cells: [hBucket, tBucket, label]
// hBucket: 0-11 (× 30° = center at hBucket*30+15)
// tBucket: 0-11 (× 1/12 value range, center at (tBucket+0.5)/12)
const GAPS = [
  [0,  0,  "red-dark"],        // Red @ 0-8%
  [2,  11, "yellow-bright"],   // Yellow @ 92-100%
  [3,  11, "y-grn-bright"],    // Y-Grn @ 92-100%
  [4,  10, "green-bright1"],   // Green @ 83-92%
  [4,  11, "green-bright2"],   // Green @ 92-100%
  [5,  1,  "g-cyn-dark"],      // G-Cyn @ 8-17%
  [5,  11, "g-cyn-bright"],    // G-Cyn @ 92-100%
  [8,  11, "blue-bright"],     // Blue @ 92-100%
  [9,  1,  "violet-dark"],     // Violet @ 8-17%
  [10, 11, "magenta-bright"],  // Magenta @ 92-100%
  [11, 1,  "m-red-dark"],      // M-Red @ 8-17%
];

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function makeLcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

async function generateTile(hBucket, tBucket, label, variant) {
  const rand = makeLcg(hBucket * 1000 + tBucket * 100 + variant);

  // Hue: center of bucket, tight jitter so it stays in bucket
  const baseHue = hBucket * 30 + 15;
  const hueJitterMax = 8;  // ±8° stays well within 30° bucket

  // Value: center of tone bucket, tight jitter
  const tMin = tBucket / 12;
  const tMax = (tBucket + 1) / 12;
  const tCenter = (tMin + tMax) / 2;
  const tMargin = (tMax - tMin) * 0.3;  // stay 30% away from bucket edges
  const baseValue = tCenter + (rand() - 0.5) * tMargin * 2;

  // Saturation: higher for dark tiles (need clear color), lower for very bright (pastel)
  const isDark = tBucket <= 2;
  const isBright = tBucket >= 10;
  let baseSat;
  if (isDark)   baseSat = 0.45 + rand() * 0.35;   // 45-80%: vivid enough to classify hue
  else if (isBright) baseSat = 0.12 + rand() * 0.25; // 12-37%: pastel
  else          baseSat = 0.30 + rand() * 0.30;

  const buf = Buffer.allocUnsafe(SIZE * SIZE * 3);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const h = ((baseHue + (rand() - 0.5) * hueJitterMax * 2) + 360) % 360;
    const v = Math.max(tMin + 0.002, Math.min(tMax - 0.002, baseValue + (rand() - 0.5) * tMargin));
    const s = Math.max(0.05, Math.min(1, baseSat + (rand() - 0.5) * 0.12));
    const [r, g, b] = hsvToRgb(h, s, v);
    buf[i * 3]     = r;
    buf[i * 3 + 1] = g;
    buf[i * 3 + 2] = b;
  }

  const outPath = path.join(OUT_DIR, `gap-${label}-${variant}.jpg`);
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .jpeg({ quality: 92 })
    .toFile(outPath);
  return outPath;
}

async function main() {
  const total = GAPS.length * VARIANTS;
  console.log(`Generating ${total} gap tiles → ${OUT_DIR}/`);
  let done = 0;
  for (const [hb, tb, label] of GAPS) {
    for (let v = 0; v < VARIANTS; v++) {
      const p = await generateTile(hb, tb, label, v);
      done++;
      process.stdout.write(`\r  ${done}/${total} — ${path.basename(p)}`);
    }
  }
  process.stdout.write("\n");
  console.log("Done.");
}

main().catch(console.error);
