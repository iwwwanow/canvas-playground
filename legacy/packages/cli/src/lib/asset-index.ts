import sharp from "sharp";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname, relative, dirname } from "node:path";
import { existsSync } from "node:fs";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AssetIndexEntry {
  /** Path relative to assets dir */
  path: string;
  /** Pre-resized 160×160 cache path, relative to assets dir */
  cache: string;
  hue: number;         // 0–360, weighted-average
  saturation: number;  // 0–1
  value: number;       // 0–1 (brightness)
  avgR: number;        // 0–255
  avgG: number;        // 0–255
  avgB: number;        // 0–255
}

export interface AssetIndex {
  version: 1;
  created: string;
  entries: AssetIndexEntry[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const CACHE_DIR = ".cache";
const CACHE_SIZE = 160;
export const INDEX_FILE = "index.json";

// ─── HSV helpers ─────────────────────────────────────────────────────────────

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = ((h * 60) + 360) % 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function analyzeBuffer(buf: Buffer, w: number, h: number) {
  let sinH = 0, cosH = 0, sumS = 0, sumV = 0, sumR = 0, sumG = 0, sumB = 0;
  let wTotal = 0;
  const stride = buf.length / (w * h) >= 4 ? 4 : 3;

  for (let i = 0; i < buf.length; i += stride) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    const [hh, s, v] = rgbToHsv(r, g, b);
    const w = s * v + 0.01;
    sinH += Math.sin(hh * Math.PI / 180) * w;
    cosH += Math.cos(hh * Math.PI / 180) * w;
    sumS += s * w; sumV += v * w;
    sumR += r * w; sumG += g * w; sumB += b * w;
    wTotal += w;
  }

  const hue = ((Math.atan2(sinH / wTotal, cosH / wTotal) * 180 / Math.PI) + 360) % 360;
  return {
    hue,
    saturation: sumS / wTotal,
    value: sumV / wTotal,
    avgR: sumR / wTotal,
    avgG: sumG / wTotal,
    avgB: sumB / wTotal,
  };
}

// ─── Scan ────────────────────────────────────────────────────────────────────

async function scanImages(dir: string, base: string): Promise<string[]> {
  const paths: string[] = [];
  async function walk(cur: string) {
    const entries = await readdir(cur, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = join(cur, e.name);
      if (e.isDirectory()) { await walk(full); }
      else if (IMAGE_EXTS.has(extname(e.name).toLowerCase())) {
        paths.push(relative(base, full));
      }
    }
  }
  await walk(dir);
  return paths;
}

// ─── Build ───────────────────────────────────────────────────────────────────

interface Source {
  /** Absolute path to scan */
  dir: string;
  /** Prefix used in cache filenames and path field, e.g. "ext__102flowers" */
  prefix: string;
}

async function processSource(
  source: Source,
  assetsDir: string,
  entries: AssetIndexEntry[],
  offset: number,
  total: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const allPaths = await scanImages(source.dir, source.dir);

  for (let i = 0; i < allPaths.length; i++) {
    const relPath = allPaths[i];
    const fullPath = join(source.dir, relPath);

    // Cache slug: prefix + flattened relative path
    const cacheSlug = (source.prefix + "__" + relPath)
      .replace(/[/\\]/g, "__")
      .replace(/\.[^.]+$/, ".jpg");
    const cachePath = join(CACHE_DIR, cacheSlug);
    const fullCache = join(assetsDir, cachePath);

    try {
      if (!existsSync(fullCache)) {
        await mkdir(dirname(fullCache), { recursive: true });
        await sharp(fullPath)
          .resize(CACHE_SIZE, CACHE_SIZE, { fit: "cover", position: "centre" })
          .removeAlpha()
          .jpeg({ quality: 85 })
          .toFile(fullCache);
      }

      const { data, info } = await sharp(fullCache)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const stats = analyzeBuffer(data, info.width, info.height);
      // path field uses prefix so it's clear where it came from
      entries.push({ path: source.prefix + "/" + relPath, cache: cachePath, ...stats });
    } catch {
      // skip corrupt files
    }

    onProgress?.(offset + i + 1, total);
  }
}

export async function buildAssetIndex(
  assetsDir: string,
  extraDirs: string[] = [],
  onProgress?: (done: number, total: number) => void,
): Promise<AssetIndex> {
  const sources: Source[] = [
    { dir: assetsDir, prefix: "local" },
    ...extraDirs.map(d => ({
      dir: d,
      prefix: "ext__" + d.replace(/.*\//, "").replace(/[^a-zA-Z0-9-]/g, "_"),
    })),
  ];

  // Count total files across all sources first
  const counts = await Promise.all(sources.map(s => scanImages(s.dir, s.dir).then(p => p.length)));
  const total = counts.reduce((a, b) => a + b, 0);

  const entries: AssetIndexEntry[] = [];
  let offset = 0;
  for (let i = 0; i < sources.length; i++) {
    await processSource(sources[i], assetsDir, entries, offset, total, onProgress);
    offset += counts[i];
  }

  return { version: 1, created: new Date().toISOString(), entries };
}

// ─── Load ────────────────────────────────────────────────────────────────────

export async function loadAssetIndex(assetsDir: string): Promise<AssetIndex | null> {
  const indexPath = join(assetsDir, INDEX_FILE);
  if (!existsSync(indexPath)) return null;
  try {
    return JSON.parse(await readFile(indexPath, "utf-8")) as AssetIndex;
  } catch {
    return null;
  }
}

export async function saveAssetIndex(assetsDir: string, index: AssetIndex): Promise<void> {
  await writeFile(join(assetsDir, INDEX_FILE), JSON.stringify(index, null, 2));
}
