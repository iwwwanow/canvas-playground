#!/usr/bin/env node
/**
 * Generate synthetic dark-tone tiles (value 2–8%) for all 12 hue buckets.
 * Saves to assets/downloaded/photos/synthetic-dark/
 * Uses only built-in node + sharp (no tsx needed).
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.resolve("assets/downloaded/photos/synthetic-dark");
const SIZE = 320;
// How many variants per hue bucket
const VARIANTS = 5;

fs.mkdirSync(OUT_DIR, { recursive: true });

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

// Simple seeded LCG random
function makeLcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

async function generateTile(hBucket, variant) {
  const rand = makeLcg(hBucket * 100 + variant);
  // Hue: center of bucket ± small jitter per pixel
  const baseHue = hBucket * 30 + 15;
  // Value: 2–7% (inside 0–8% bucket)
  const baseValue = 0.02 + rand() * 0.05;
  // Saturation: low-to-medium so it still looks dark but tinted
  const baseSat = 0.15 + rand() * 0.35;

  const pixels = SIZE * SIZE * 3;
  const buf = Buffer.allocUnsafe(pixels);

  for (let i = 0; i < SIZE * SIZE; i++) {
    // Per-pixel noise: tiny hue drift + value grain
    const hJitter = (rand() - 0.5) * 20;
    const vJitter = (rand() - 0.5) * 0.015;
    const sJitter = (rand() - 0.5) * 0.08;

    const h = ((baseHue + hJitter) + 360) % 360;
    const v = Math.max(0.005, Math.min(0.079, baseValue + vJitter));
    const s = Math.max(0, Math.min(1, baseSat + sJitter));

    const [r, g, b] = hsvToRgb(h, s, v);
    buf[i * 3]     = r;
    buf[i * 3 + 1] = g;
    buf[i * 3 + 2] = b;
  }

  const hueName = [
    "red","orange","yellow","y-grn","green",
    "g-cyn","cyan","c-blu","blue","violet","magenta","m-red"
  ][hBucket];

  const outPath = path.join(OUT_DIR, `dark-${hueName}-${variant}.jpg`);
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .jpeg({ quality: 90 })
    .toFile(outPath);

  return outPath;
}

async function main() {
  const NODE_PATH_EXTRA = path.resolve("node_modules/.pnpm/sharp@0.34.5/node_modules");
  console.log(`Generating ${12 * VARIANTS} dark tiles → ${OUT_DIR}/`);

  let done = 0;
  for (let h = 0; h < 12; h++) {
    for (let v = 0; v < VARIANTS; v++) {
      const p = await generateTile(h, v);
      done++;
      process.stdout.write(`\r  ${done}/${12 * VARIANTS} — ${path.basename(p)}`);
    }
  }
  process.stdout.write("\n");
  console.log("Done.");
}

main().catch(console.error);
