#!/usr/bin/env npx tsx
/**
 * Analyze assets directory and output a 12x12 hue×tone distribution table.
 * Hue: 12 buckets × 30° (0=Red, 1=Orange, ..., 11=Pink/Magenta)
 * Tone (Value/Brightness): 12 buckets × ~8.3% (0=very dark, 11=very bright)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require("sharp");
import * as fs from "fs";
import * as path from "path";

const ASSETS_DIR = path.resolve(process.cwd(), "assets/downloaded/photos");

const HUE_LABELS = [
  "Red",    // 0–30°
  "Orange", // 30–60°
  "Yellow", // 60–90°
  "Y-Grn",  // 90–120°
  "Green",  // 120–150°
  "G-Cyn",  // 150–180°
  "Cyan",   // 180–210°
  "C-Blu",  // 210–240°
  "Blue",   // 240–270°
  "Violet", // 270–300°
  "Magenta",// 300–330°
  "M-Red",  // 330–360°
];

const TONE_LABELS = [
  "0–8%",
  "8–17%",
  "17–25%",
  "25–33%",
  "33–42%",
  "42–50%",
  "50–58%",
  "58–67%",
  "67–75%",
  "75–83%",
  "83–92%",
  "92–100%",
];

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = ((h * 60) + 360) % 360;
  }
  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return [h, s, v];
}

async function getDominantHSV(filePath: string): Promise<[number, number, number] | null> {
  try {
    const { data, info } = await sharp(filePath)
      .resize(64, 64, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let totalH_sin = 0, totalH_cos = 0, totalS = 0, totalV = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const [h, s, v] = rgbToHsv(r, g, b);
      // Weight by saturation so grey pixels don't pollute hue
      const w = s * v + 0.01;
      totalH_sin += Math.sin((h * Math.PI) / 180) * w;
      totalH_cos += Math.cos((h * Math.PI) / 180) * w;
      totalS += s * w;
      totalV += v * w;
      count += w;
    }

    const avgH = ((Math.atan2(totalH_sin / count, totalH_cos / count) * 180) / Math.PI + 360) % 360;
    const avgS = totalS / count;
    const avgV = totalV / count;
    return [avgH, avgS, avgV];
  } catch {
    return null;
  }
}

async function main() {
  const grid: { count: number; files: string[] }[][] = Array.from({ length: 12 }, () =>
    Array.from({ length: 12 }, () => ({ count: 0, files: [] }))
  );

  const categories = fs.readdirSync(ASSETS_DIR).filter(d =>
    fs.statSync(path.join(ASSETS_DIR, d)).isDirectory()
  );

  let total = 0;
  const allFiles: string[] = [];

  for (const cat of categories) {
    const catDir = path.join(ASSETS_DIR, cat);
    const files = fs.readdirSync(catDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    for (const f of files) {
      allFiles.push(path.join(catDir, f));
    }
  }

  console.error(`Analyzing ${allFiles.length} images...`);

  // Process in batches of 20
  const BATCH = 20;
  for (let i = 0; i < allFiles.length; i += BATCH) {
    const batch = allFiles.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(getDominantHSV));
    for (let j = 0; j < batch.length; j++) {
      const hsv = results[j];
      if (!hsv) continue;
      const [h, s, v] = hsv;
      const hBucket = Math.min(11, Math.floor(h / 30));
      const tBucket = Math.min(11, Math.floor(v * 12));
      grid[hBucket][tBucket].count++;
      grid[hBucket][tBucket].files.push(path.relative(ASSETS_DIR, batch[j]));
      total++;
    }
    process.stderr.write(`\r${Math.min(i + BATCH, allFiles.length)}/${allFiles.length}`);
  }
  process.stderr.write("\n");

  // Print table: rows = hue, cols = tone
  const COL_W = 6;
  const LABEL_W = 10;

  // Header
  process.stdout.write("Hue \\ Tone".padEnd(LABEL_W));
  for (const tl of TONE_LABELS) process.stdout.write(tl.padStart(COL_W));
  process.stdout.write("  TOTAL\n");
  process.stdout.write("-".repeat(LABEL_W + 12 * COL_W + 8) + "\n");

  for (let h = 0; h < 12; h++) {
    const rowTotal = grid[h].reduce((s, c) => s + c.count, 0);
    process.stdout.write(HUE_LABELS[h].padEnd(LABEL_W));
    for (let t = 0; t < 12; t++) {
      const n = grid[h][t].count;
      const cell = n === 0 ? "·" : String(n);
      process.stdout.write(cell.padStart(COL_W));
    }
    process.stdout.write(`  ${rowTotal}\n`);
  }

  // Column totals
  process.stdout.write("-".repeat(LABEL_W + 12 * COL_W + 8) + "\n");
  process.stdout.write("TOTAL".padEnd(LABEL_W));
  for (let t = 0; t < 12; t++) {
    const n = grid.reduce((s, row) => s + row[t].count, 0);
    process.stdout.write(String(n).padStart(COL_W));
  }
  process.stdout.write(`  ${total}\n`);

  // Empty cells list
  const missing: string[] = [];
  for (let h = 0; h < 12; h++) {
    for (let t = 0; t < 12; t++) {
      if (grid[h][t].count === 0) {
        missing.push(`${HUE_LABELS[h]} @ ${TONE_LABELS[t]}`);
      }
    }
  }
  if (missing.length) {
    process.stdout.write(`\nEmpty cells (${missing.length}):\n`);
    for (const m of missing) process.stdout.write(`  · ${m}\n`);
  }
}

main().catch(console.error);
