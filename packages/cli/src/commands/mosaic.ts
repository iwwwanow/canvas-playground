import { mkdirSync, createWriteStream, unlinkSync } from "node:fs";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { get as httpsGet } from "node:https";
import sharp from "sharp";
import { MosaicSegment, rgbToHsl, hslToRgb } from "@xtc-toaster/core";
import type { Segment } from "@xtc-toaster/core";
import { scanAssetsDir, loadAsset } from "../lib/extract-asset-frames.js";
import { extractFrames } from "../lib/extract-video-frames.js";
import { openVideoStream } from "../lib/assemble-video.js";
import { mapConcurrent } from "../lib/concurrent.js";
import {
  buildAssetIndex,
  loadAssetIndex,
  saveAssetIndex,
} from "../lib/asset-index.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MosaicSegmentsFile {
  width: number;
  height: number;
  fps: number;
  segments: Segment[][];  // one Segment[] per source frame
}

// ─── mosaic segment (image) ──────────────────────────────────────────────────

export interface MosaicSegmentOptions {
  input: string;
  output: string;
  tones?: number;
  hues?: number;
  minRegion?: number;
}

export async function mosaicSegmentCommand(opts: MosaicSegmentOptions): Promise<void> {
  const params = {
    tones: opts.tones ?? 6,
    hues: opts.hues ?? 6,
    minRegionSize: opts.minRegion ?? 200,
  };

  console.log(`Loading ${opts.input}...`);
  const { data, info } = await sharp(opts.input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelData = new Uint8ClampedArray(data.buffer);

  console.log(`Segmenting ${info.width}×${info.height} (tones=${params.tones}, hues=${params.hues})...`);
  const segs = MosaicSegment.segment(pixelData, info.width, info.height, params);

  mkdirSync(opts.output, { recursive: true });

  const file: MosaicSegmentsFile = { width: info.width, height: info.height, fps: 24, segments: [segs] };
  const jsonPath = join(opts.output, "segments.json");
  await writeFile(jsonPath, JSON.stringify(file, null, 2));
  console.log(`Segments saved → ${jsonPath} (${segs.length} rects)`);

  const debugOutput = MosaicSegment.bake(pixelData, info.width, info.height, params);
  if (debugOutput.type === "image") {
    const debugPath = join(opts.output, "debug.png");
    await sharp(Buffer.from(debugOutput.data.buffer), {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png().toFile(debugPath);
    console.log(`Debug image saved → ${debugPath}`);
  }
}

// ─── mosaic frames (video → rect sequence) ──────────────────────────────────

export interface MosaicFramesOptions {
  input: string;
  output: string;
  fps?: number;
  tones?: number;
  hues?: number;
  minRegion?: number;
}

export async function mosaicFramesCommand(opts: MosaicFramesOptions): Promise<void> {
  const fps = opts.fps ?? 24;
  const params = {
    tones: opts.tones ?? 6,
    hues: opts.hues ?? 6,
    minRegionSize: opts.minRegion ?? 200,
  };

  mkdirSync(opts.output, { recursive: true });

  const allSegments: Segment[][] = [];
  let imgWidth = 0, imgHeight = 0;
  let frameCount = 0;

  console.log(`Extracting frames from ${opts.input} at ${fps}fps...`);
  const result = await extractFrames(opts.input, fps, async (frame) => {
    if (frame.index === 0) {
      imgWidth = frame.width;
      imgHeight = frame.height;
    }

    const segs = MosaicSegment.segment(frame.data, imgWidth, imgHeight, params);
    allSegments.push(segs);

    const vizData = MosaicSegment.visualize(frame.data, imgWidth, imgHeight, segs);
    const framePath = join(opts.output, `frame_${String(frame.index).padStart(5, "0")}.png`);
    await sharp(Buffer.from(vizData.buffer), {
      raw: { width: imgWidth, height: imgHeight, channels: 4 },
    }).png().toFile(framePath);

    frameCount++;
    process.stdout.write(`\r  ${frameCount} frames rendered`);
  });

  process.stdout.write(`\r  ${frameCount}/${result.totalFrames} frames rendered\n`);

  const file: MosaicSegmentsFile = { width: imgWidth, height: imgHeight, fps, segments: allSegments };
  await writeFile(join(opts.output, "segments.json"), JSON.stringify(file, null, 2));

  console.log(`Done. ${frameCount} frames saved → ${opts.output}/`);
  console.log(`Segments → ${join(opts.output, "segments.json")}`);
}

// ─── mosaic index-assets ─────────────────────────────────────────────────────

export interface IndexAssetsOptions {
  assets: string;
  extra?: string[];
}

export async function indexAssetsCommand(opts: IndexAssetsOptions): Promise<void> {
  const assetsDir = opts.assets;
  const extra = opts.extra ?? [];

  console.log(`Scanning ${assetsDir}...`);
  if (extra.length) console.log(`Extra sources: ${extra.join(", ")}`);

  let lastPct = -1;
  const index = await buildAssetIndex(assetsDir, extra, (done, total) => {
    const pct = Math.floor((done / total) * 100);
    if (pct !== lastPct) {
      process.stdout.write(`\r  ${done}/${total} (${pct}%)`);
      lastPct = pct;
    }
  });
  process.stdout.write("\n");

  await saveAssetIndex(assetsDir, index);
  console.log(`Index saved → ${assetsDir}/index.json (${index.entries.length} entries)`);
}

// ─── mosaic collect-assets ───────────────────────────────────────────────────

export interface CollectAssetsOptions {
  output: string;    // output dir
  count?: number;    // number of assets to download (default 20)
  query?: string;    // search query hint (used as seed for picsum, ignored otherwise)
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    httpsGet(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        unlinkSync(destPath);
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
      file.on("error", reject);
    }).on("error", reject);
  });
}

export async function collectAssetsCommand(opts: CollectAssetsOptions): Promise<void> {
  const count = opts.count ?? 20;
  mkdirSync(opts.output, { recursive: true });

  console.log(`Downloading ${count} images from Lorem Picsum → ${opts.output}/`);

  let downloaded = 0;
  for (let i = 0; i < count; i++) {
    const seed = opts.query ? `${opts.query}-${i}` : String(i + 1);
    // 640×360: small enough to be fast, large enough for detail
    const url = `https://picsum.photos/seed/${seed}/320/320`;
    const dest = join(opts.output, `asset_${String(i).padStart(3, "0")}.jpg`);
    try {
      await downloadFile(url, dest);
      downloaded++;
      process.stdout.write(`\r  ${downloaded}/${count} downloaded`);
    } catch (e) {
      process.stdout.write(`\n  Failed: ${url} — ${(e as Error).message}\n`);
    }
  }

  process.stdout.write(`\n`);
  console.log(`${downloaded} assets saved → ${opts.output}/`);
  process.exit(0);
}

// ─── mosaic render ───────────────────────────────────────────────────────────

export interface MosaicRenderOptions {
  segments: string;        // path to segments.json
  assets: string;          // path to assets dir
  output: string;          // output mp4/gif path
  duration?: number;       // seconds (default: use fps from segments.json)
  fps?: number;
  format?: "mp4" | "gif";
  mode?: "photo" | "solid";
  saveFrames?: boolean;    // save JPEG frame sequence alongside output (default true)
  maxTile?: number;        // max cell size in px; large segments are subdivided into a grid, each cell gets its own asset
  minTile?: number;        // min cell size in px; small segments are padded up to this size
  tintTiles?: boolean;     // overlay-blend each tile with its segment color (preserves texture, enforces palette)
  tintStrength?: number;   // opacity of tint overlay (0–1, default 1.0)
  gradientMap?: boolean;   // remap luminance: darks→segment color, lights→white
  hueTiles?: boolean;      // replace photo hue with segment color hue, keep luminance+saturation
  boostTiles?: boolean;    // parabolic white/black overlay per tile: bright→whiter, dark→darker, mid unaffected
  boostStrength?: number;  // strength of boost (0–1, default 0.3)
  blurTiles?: boolean;     // blur tiles proportionally to their size (softer, more painterly)
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
}

interface ClusterSwapState {
  rankIdx: number;       // current position in similarity ranking
  nextSwapFrame: number;
}

class AssetScheduler {
  private swapStates = new Map<number, ClusterSwapState>();
  private rankingCache = new Map<number, number[]>();

  constructor(
    private assetAvgColors: Array<[number, number, number]>,
    private fps: number,
  ) {}

  private getRanking(clusterId: number, color: [number, number, number]): number[] {
    if (!this.rankingCache.has(clusterId)) {
      const ranked = this.assetAvgColors
        .map((ac, i) => ({ i, d: colorDist(color, ac) }))
        .sort((a, b) => a.d - b.d)
        .map(x => x.i);
      this.rankingCache.set(clusterId, ranked);
    }
    return this.rankingCache.get(clusterId)!;
  }

  // SPREAD: prime offset so sibling segments step through ranked list without clustering
  private static readonly SPREAD = 7;

  getAssetIdx(
    clusterId: number,
    color: [number, number, number],
    frameIdx: number,
    siblingIdx: number,   // nth segment of this cluster in the current frame
  ): number {
    const ranked = this.getRanking(clusterId, color);

    if (!this.swapStates.has(clusterId)) {
      const durationFrames = Math.max(1, Math.round(this.fps * (0.2 + Math.random() * 0.8)));
      this.swapStates.set(clusterId, { rankIdx: 0, nextSwapFrame: durationFrames });
    }

    const state = this.swapStates.get(clusterId)!;
    if (frameIdx >= state.nextSwapFrame) {
      state.rankIdx = (state.rankIdx + 1) % ranked.length;
      const durationFrames = Math.max(1, Math.round(this.fps * (0.2 + Math.random() * 0.8)));
      state.nextSwapFrame = frameIdx + durationFrames;
    }

    // Each sibling picks a different position in the ranked list
    return ranked[(state.rankIdx + siblingIdx * AssetScheduler.SPREAD) % ranked.length];
  }
}

// ─── shared asset loader ─────────────────────────────────────────────────────

const MAX_ASSETS = 200;
const ASSET_MAX_DIM = 160;
const MAX_FRAMES_PER_ASSET = 4;

type LoadedAsset = Awaited<ReturnType<typeof loadAsset>>;

/** Color info paired with pixel data — used by AssetScheduler when index available. */
export interface IndexedAsset extends LoadedAsset {
  avgR: number;
  avgG: number;
  avgB: number;
}

async function loadAssetsFromIndex(assetsDir: string): Promise<IndexedAsset[]> {
  const index = await loadAssetIndex(assetsDir);
  if (!index) return [];

  const entries = index.entries.sort(() => Math.random() - 0.5).slice(0, MAX_ASSETS);
  console.log(`Using index: ${index.entries.length} total, loading ${entries.length} assets from cache...`);

  const assets: IndexedAsset[] = [];
  for (let i = 0; i < entries.length; i++) {
    process.stdout.write(`\r  ${i + 1}/${entries.length}`);
    const e = entries[i];
    const cacheFull = join(assetsDir, e.cache);
    try {
      const { data, info } = await sharp(cacheFull)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      assets.push({
        frames: [data],
        width: info.width,
        height: info.height,
        avgR: e.avgR,
        avgG: e.avgG,
        avgB: e.avgB,
      });
    } catch {
      // skip corrupt cache entries
    }
  }
  process.stdout.write("\n");
  return assets;
}

async function loadAssets(assetsDir: string): Promise<IndexedAsset[]> {
  // Fast path: use pre-built index + cached thumbnails
  const indexed = await loadAssetsFromIndex(assetsDir);
  if (indexed.length > 0) return indexed;

  // Slow path: scan raw files (no index present)
  console.log("No index.json found — scanning raw files (slow). Run `mosaic index-assets` first.");
  const assetPaths = await scanAssetsDir(assetsDir);
  if (assetPaths.length === 0) { console.error("No assets found."); process.exit(1); }

  const shuffled = assetPaths.sort(() => Math.random() - 0.5).slice(0, MAX_ASSETS);
  console.log(`Found ${assetPaths.length} asset(s), using ${shuffled.length}. Extracting frames...`);

  const assets: IndexedAsset[] = [];
  for (let i = 0; i < shuffled.length; i++) {
    process.stdout.write(`\r  ${i+1}/${shuffled.length}`);
    const raw = await loadAsset(shuffled[i], MAX_FRAMES_PER_ASSET);
    const needsResize = raw.width > ASSET_MAX_DIM || raw.height > ASSET_MAX_DIM;
    let frames = raw.frames;
    let w = raw.width, h = raw.height;
    if (needsResize) {
      const scale = Math.min(ASSET_MAX_DIM / w, ASSET_MAX_DIM / h);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const resized: Buffer[] = [];
      for (const frame of frames) {
        const { data } = await sharp(frame, { raw: { width: raw.width, height: raw.height, channels: 4 } })
          .resize(w, h, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
        resized.push(data);
      }
      frames = resized;
    }
    // Compute avg color from first frame
    const mid = frames[Math.floor(frames.length / 2)];
    const avgColor = computeAvgColor(mid, w, h);
    assets.push({ frames, width: w, height: h, ...avgColor });
  }
  process.stdout.write("\n");
  return assets;
}

function computeAvgColor(buf: Buffer, w: number, h: number): { avgR: number; avgG: number; avgB: number } {
  const pixels = w * h;
  let r = 0, g = 0, b = 0;
  const stride = buf.length / pixels >= 4 ? 4 : 3;
  for (let i = 0; i < buf.length; i += stride) { r += buf[i]; g += buf[i+1]; b += buf[i+2]; }
  return { avgR: r/pixels, avgG: g/pixels, avgB: b/pixels };
}

async function makeSolidTile(
  r: number, g: number, b: number,
  tileW: number, tileH: number,
  angle: number,
  width: number, height: number,
): Promise<sharp.OverlayOptions> {
  let tileWidth = tileW;
  let tileHeight = tileH;

  if (angle !== 0) {
    const radians = Math.abs(angle * Math.PI / 180);
    const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
    let rotW = Math.ceil(tileW * cos + tileH * sin);
    let rotH = Math.ceil(tileW * sin + tileH * cos);
    if (rotW > width || rotH > height) {
      const scale = Math.min(width / rotW, height / rotH);
      rotW = Math.max(1, Math.floor(rotW * scale));
      rotH = Math.max(1, Math.floor(rotH * scale));
    }
    // Create solid tile then rotate it
    const { data, info } = await sharp({
      create: { width: tileW, height: tileH, channels: 4, background: { r, g, b, alpha: 255 } },
    })
      .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(rotW, rotH, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    tileWidth = info.width;
    tileHeight = info.height;
    return {
      input: Buffer.from(data.buffer),
      raw: { width: tileWidth, height: tileHeight, channels: 4 as const },
      left: Math.round(tileW / 2 - tileWidth / 2),
      top: Math.round(tileH / 2 - tileHeight / 2),
    };
  }

  const { data } = await sharp({
    create: { width: tileW, height: tileH, channels: 4, background: { r, g, b, alpha: 255 } },
  }).raw().toBuffer({ resolveWithObject: true });
  return {
    input: Buffer.from(data.buffer),
    raw: { width: tileWidth, height: tileHeight, channels: 4 as const },
    left: 0, top: 0,
  };
}

/** Gradient map: dark pixels → segment color, light pixels → white */
function applyGradientMap(buf: Buffer, sr: number, sg: number, sb: number): Buffer {
  const result = Buffer.allocUnsafe(buf.length);
  for (let i = 0; i < buf.length; i += 4) {
    const luma = (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) / 255;
    result[i]   = Math.round(sr + (255 - sr) * luma);
    result[i+1] = Math.round(sg + (255 - sg) * luma);
    result[i+2] = Math.round(sb + (255 - sb) * luma);
    result[i+3] = buf[i+3];
  }
  return result;
}

/** Hue blend: replace photo hue with segment color hue, keep luminance + saturation */
function applyHueBlend(buf: Buffer, sr: number, sg: number, sb: number): Buffer {
  const [segH] = rgbToHsl([sr / 255, sg / 255, sb / 255]);
  const result = Buffer.allocUnsafe(buf.length);
  for (let i = 0; i < buf.length; i += 4) {
    const [, s, l] = rgbToHsl([buf[i] / 255, buf[i+1] / 255, buf[i+2] / 255]);
    const [nr, ng, nb] = hslToRgb([segH, s, l]);
    result[i]   = Math.round(nr * 255);
    result[i+1] = Math.round(ng * 255);
    result[i+2] = Math.round(nb * 255);
    result[i+3] = buf[i+3];
  }
  return result;
}

function avgBrightness(buf: Buffer): number {
  let sum = 0;
  const pixels = buf.length / 4;
  for (let i = 0; i < buf.length; i += 4)
    sum += (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) / 255;
  return sum / pixels;
}

async function boostTileContrast(buf: Buffer, w: number, h: number, strength: number): Promise<Buffer> {
  const v = avgBrightness(buf);
  if (v <= 0.5) return buf;  // dark tiles untouched
  const t = (2 * v - 1) ** 2 * strength;
  if (t < 0.005) return buf;
  const alpha = Math.round(t * 255);
  const bg = { r: 255, g: 255, b: 255, alpha };
  const { data: overlay } = await sharp({
    create: { width: w, height: h, channels: 4, background: bg },
  }).raw().toBuffer({ resolveWithObject: true });
  const { data } = await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .composite([{ input: overlay, raw: { width: w, height: h, channels: 4 as const }, blend: "over" }])
    .raw().toBuffer({ resolveWithObject: true });
  return data;
}

async function renderSegments(
  assets: IndexedAsset[],
  segFile: MosaicSegmentsFile,
  output: string,
  opts: { fps?: number; duration?: number; format?: "mp4" | "gif"; mode?: "photo" | "solid"; saveFrames?: boolean; maxTile?: number; minTile?: number; tintTiles?: boolean; tintStrength?: number; gradientMap?: boolean; hueTiles?: boolean; boostTiles?: boolean; boostStrength?: number; blurTiles?: boolean },
): Promise<void> {
  const { width, height, segments: allSegments, fps: fileFps } = segFile;
  const fps = opts.fps ?? fileFps ?? 24;
  const format = opts.format ?? "mp4";
  const totalFrames = Math.round((opts.duration ?? 5) * fps);
  const mode = opts.mode ?? "photo";
  const saveFrames = opts.saveFrames ?? true;

  const framesDir = output + ".frames";
  if (saveFrames) {
    await mkdir(framesDir, { recursive: true });
  }

  let scheduler: AssetScheduler | null = null;
  if (mode === "photo") {
    const assetAvgColors: Array<[number, number, number]> = assets.map(a =>
      [a.avgR, a.avgG, a.avgB]
    );
    scheduler = new AssetScheduler(assetAvgColors, fps);
  }

  console.log(`Rendering ${totalFrames} frames (${width}×${height}, ${fps}fps, mode=${mode})...`);
  const stream = openVideoStream(width, height, fps, format, output);

  for (let f = 0; f < totalFrames; f++) {
    const segments = allSegments[f % allSegments.length];

    // Pre-compute sibling index: nth occurrence of each clusterId in this frame
    const clusterCount = new Map<number, number>();
    const siblingIndices = segments.map(seg => {
      const n = clusterCount.get(seg.clusterId) ?? 0;
      clusterCount.set(seg.clusterId, n + 1);
      return n;
    });

    const compositeInputs: sharp.OverlayOptions[] = (await mapConcurrent(
      segments, 2, async (seg, segIdx): Promise<sharp.OverlayOptions[]> => {
        const rawW = Math.max(1, Math.min(Math.round(seg.width), width));
        const rawH = Math.max(1, Math.min(Math.round(seg.height), height));
        const [sr, sg, sb] = seg.color;

        if (mode === "solid") {
          const tile = await makeSolidTile(sr, sg, sb, rawW, rawH, seg.angle, width, height);
          return [{ ...tile, left: Math.round(seg.cx - rawW / 2), top: Math.round(seg.cy - rawH / 2) }];
        }


        // ── build tile buffer ─────────────────────────────────────────────────
        const cellW = opts.maxTile ? Math.min(opts.maxTile, rawW) : rawW;
        const cellH = opts.maxTile ? Math.min(opts.maxTile, rawH) : rawH;

        // Inline blending helper (sync operations only)
        const blendSync = (buf: Buffer): Buffer => {
          let b = buf;
          if (opts.gradientMap) b = applyGradientMap(b, sr, sg, sb);
          if (opts.hueTiles)    b = applyHueBlend(b, sr, sg, sb);
          return b;
        };

        // Resize one asset frame to target dimensions
        const resizeAsset = (a: IndexedAsset, w: number, h: number) =>
          sharp(a.frames[f % a.frames.length], { raw: { width: a.width, height: a.height, channels: 4 } })
            .resize(w, h, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

        let flatBuf: Buffer;
        let bufW: number, bufH: number;

        if (opts.maxTile && (rawW > cellW || rawH > cellH)) {
          // Grid subdivision: tile segment area with per-cell tone-matched assets
          const tiled = Buffer.alloc(rawW * rawH * 4, 0);
          let cellIdx = 0;
          for (let ty = 0; ty < rawH; ty += cellH) {
            const ch = Math.min(cellH, rawH - ty);
            for (let tx = 0; tx < rawW; tx += cellW) {
              const cw = Math.min(cellW, rawW - tx);
              const ci = scheduler!.getAssetIdx(seg.clusterId, seg.color, f, siblingIndices[segIdx] + cellIdx++);
              const { data: cd } = await resizeAsset(assets[ci], cw, ch);
              const cb = blendSync(cd);
              for (let row = 0; row < ch; row++) {
                cb.copy(tiled, ((ty + row) * rawW + tx) * 4, row * cw * 4, (row + 1) * cw * 4);
              }
            }
          }
          flatBuf = tiled;
          bufW = rawW; bufH = rawH;
        } else {
          // Single tile: full segment size
          const ai = scheduler!.getAssetIdx(seg.clusterId, seg.color, f, siblingIndices[segIdx]);
          const { data } = await resizeAsset(assets[ai], rawW, rawH);
          flatBuf = blendSync(data);
          bufW = rawW; bufH = rawH;
        }

        // Async blending (requires sharp)
        if (opts.tintTiles) {
          const tintStrength = opts.tintStrength ?? 1.0;
          if (tintStrength > 0) {
            const { data: colorBuf } = await sharp({
              create: { width: bufW, height: bufH, channels: 4, background: { r: sr, g: sg, b: sb, alpha: 255 } },
            }).raw().toBuffer({ resolveWithObject: true });
            const { data: fullyTinted } = await sharp(flatBuf, { raw: { width: bufW, height: bufH, channels: 4 } })
              .composite([{ input: colorBuf, raw: { width: bufW, height: bufH, channels: 4 as const }, blend: "overlay" }])
              .raw().toBuffer({ resolveWithObject: true });
            if (tintStrength >= 1.0) {
              flatBuf = fullyTinted;
            } else {
              const result = Buffer.allocUnsafe(flatBuf.length);
              const s = tintStrength, inv = 1 - s;
              for (let i = 0; i < flatBuf.length; i += 4) {
                result[i]   = Math.round(flatBuf[i]   * inv + fullyTinted[i]   * s);
                result[i+1] = Math.round(flatBuf[i+1] * inv + fullyTinted[i+1] * s);
                result[i+2] = Math.round(flatBuf[i+2] * inv + fullyTinted[i+2] * s);
                result[i+3] = flatBuf[i+3];
              }
              flatBuf = result;
            }
          }
        }
        if (opts.boostTiles) flatBuf = await boostTileContrast(flatBuf, bufW, bufH, opts.boostStrength ?? 0.3);
        if (opts.blurTiles) {
          const sigma = Math.max(0.3, Math.min(bufW, bufH) / 20);
          const { data: blurred } = await sharp(flatBuf, { raw: { width: bufW, height: bufH, channels: 4 } })
            .blur(sigma).raw().toBuffer({ resolveWithObject: true });
          flatBuf = blurred;
        }

        if (seg.angle !== 0) {
          const radians = Math.abs(seg.angle * Math.PI / 180);
          const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
          const rotW = Math.ceil(bufW * cos + bufH * sin);
          const rotH = Math.ceil(bufW * sin + bufH * cos);
          let rotPipeline = sharp(flatBuf, { raw: { width: bufW, height: bufH, channels: 4 } })
            .rotate(seg.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .ensureAlpha();
          if (rotW > width || rotH > height) {
            const scale = Math.min(width / rotW, height / rotH);
            rotPipeline = rotPipeline.resize(Math.max(1, Math.floor(rotW * scale)), Math.max(1, Math.floor(rotH * scale))) as typeof rotPipeline;
          }
          const { data: rotated, info: rotInfo } = await rotPipeline.raw().toBuffer({ resolveWithObject: true });
          return [{ input: Buffer.from(rotated.buffer), raw: { width: rotInfo.width, height: rotInfo.height, channels: 4 as const }, left: Math.round(seg.cx - rotInfo.width / 2), top: Math.round(seg.cy - rotInfo.height / 2) }];
        }

        return [{ input: flatBuf, raw: { width: bufW, height: bufH, channels: 4 as const }, left: Math.round(seg.cx - bufW / 2), top: Math.round(seg.cy - bufH / 2) }];
      }
    )).flat();

    const COMPOSITE_CHUNK = 200;
    let frameBuffer: Buffer = await sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    }).raw().toBuffer();

    for (let c = 0; c < compositeInputs.length; c += COMPOSITE_CHUNK) {
      const chunk = compositeInputs.slice(c, c + COMPOSITE_CHUNK);
      const { data } = await sharp(frameBuffer, { raw: { width, height, channels: 4 } })
        .composite(chunk)
        .raw()
        .toBuffer({ resolveWithObject: true });
      frameBuffer = data;
    }

    await stream.writeFrame(new Uint8ClampedArray(frameBuffer.buffer));

    if (saveFrames) {
      const framePath = join(framesDir, `frame_${String(f).padStart(5, "0")}.jpg`);
      await sharp(frameBuffer, { raw: { width, height, channels: 4 } })
        .jpeg({ quality: 90 })
        .toFile(framePath);
    }

    if ((f + 1) % 10 === 0 || f === totalFrames - 1)
      process.stdout.write(`\r  ${f+1}/${totalFrames} frames composed`);
  }
  process.stdout.write("\n");
  process.stdout.write("Finalizing video...\n");
  await stream.close();
  console.log(`Mosaic rendered → ${output}`);
  if (saveFrames) console.log(`Frames saved  → ${framesDir}/`);
}

export async function mosaicRenderCommand(opts: MosaicRenderOptions): Promise<void> {
  const segFile: MosaicSegmentsFile = JSON.parse((await readFile(opts.segments)).toString());
  let assets: IndexedAsset[] = [];
  if ((opts.mode ?? "photo") === "photo") {
    console.log(`Loading assets from ${opts.assets}...`);
    assets = await loadAssets(opts.assets);
    if (opts.maxTile) console.log(`Tile mode: max ${opts.maxTile}px, repeat fill`);
  }
  await renderSegments(assets, segFile, opts.output, opts);
}

// ─── mosaic batch-render ──────────────────────────────────────────────────────

export interface MosaicBatchRenderOptions {
  segments: string[];      // multiple segments.json paths
  assets: string;
  outputDir: string;
  duration?: number;
  fps?: number;
  format?: "mp4" | "gif";
}

export async function mosaicBatchRenderCommand(opts: MosaicBatchRenderOptions): Promise<void> {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(opts.outputDir, { recursive: true });

  console.log(`Loading assets from ${opts.assets} (once for all renders)...`);
  const assets = await loadAssets(opts.assets);

  for (let i = 0; i < opts.segments.length; i++) {
    const segPath = opts.segments[i];
    const name = segPath.replace(/.*\//, "").replace(/\/segments\.json$/, "").replace(/segments\.json$/, "seg");
    const outFile = `${opts.outputDir}/${name}.${opts.format ?? "mp4"}`;
    console.log(`\n[${i+1}/${opts.segments.length}] ${segPath} → ${outFile}`);
    const segFile: MosaicSegmentsFile = JSON.parse((await readFile(segPath)).toString());
    await renderSegments(assets, segFile, outFile, opts);
  }
  console.log(`\nAll done → ${opts.outputDir}/`);
}
