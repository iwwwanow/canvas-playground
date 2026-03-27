import { mkdirSync, createWriteStream, unlinkSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { get as httpsGet } from "node:https";
import sharp from "sharp";
import { MosaicSegment } from "@xtc-toaster/core";
import type { Segment } from "@xtc-toaster/core";
import { scanAssetsDir, loadAsset } from "../lib/extract-asset-frames.js";
import { extractFrames } from "../lib/extract-video-frames.js";
import { openVideoStream } from "../lib/assemble-video.js";
import { mapConcurrent } from "../lib/concurrent.js";

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
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
}

function avgColor(buf: Buffer, w: number, h: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const pixels = w * h;
  for (let i = 0; i < buf.length; i += 4) { r += buf[i]; g += buf[i+1]; b += buf[i+2]; }
  return [r/pixels, g/pixels, b/pixels];
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

  getAssetIdx(clusterId: number, color: [number, number, number], frameIdx: number): number {
    const ranked = this.getRanking(clusterId, color);

    if (!this.swapStates.has(clusterId)) {
      const durationFrames = Math.max(1, Math.round(this.fps * (0.2 + Math.random() * 0.8)));
      this.swapStates.set(clusterId, { rankIdx: 0, nextSwapFrame: durationFrames });
      return ranked[0];
    }

    const state = this.swapStates.get(clusterId)!;
    if (frameIdx >= state.nextSwapFrame) {
      state.rankIdx = (state.rankIdx + 1) % ranked.length;
      const durationFrames = Math.max(1, Math.round(this.fps * (0.2 + Math.random() * 0.8)));
      state.nextSwapFrame = frameIdx + durationFrames;
    }

    return ranked[state.rankIdx];
  }
}

// ─── shared asset loader ─────────────────────────────────────────────────────

const MAX_ASSETS = 200;
const ASSET_MAX_DIM = 160;
const MAX_FRAMES_PER_ASSET = 4;

type LoadedAsset = Awaited<ReturnType<typeof loadAsset>>;

async function loadAssets(assetsDir: string): Promise<LoadedAsset[]> {
  const assetPaths = await scanAssetsDir(assetsDir);
  if (assetPaths.length === 0) { console.error("No assets found."); process.exit(1); }

  const shuffled = assetPaths.sort(() => Math.random() - 0.5).slice(0, MAX_ASSETS);
  console.log(`Found ${assetPaths.length} asset(s), using ${shuffled.length}. Extracting frames...`);

  const assets: LoadedAsset[] = [];
  for (let i = 0; i < shuffled.length; i++) {
    process.stdout.write(`\r  ${i+1}/${shuffled.length}`);
    const raw = await loadAsset(shuffled[i], MAX_FRAMES_PER_ASSET);
    const needsResize = raw.width > ASSET_MAX_DIM || raw.height > ASSET_MAX_DIM;
    if (needsResize) {
      const scale = Math.min(ASSET_MAX_DIM / raw.width, ASSET_MAX_DIM / raw.height);
      const dstW = Math.max(1, Math.round(raw.width * scale));
      const dstH = Math.max(1, Math.round(raw.height * scale));
      const resized: Buffer[] = [];
      for (const frame of raw.frames) {
        const { data } = await sharp(frame, { raw: { width: raw.width, height: raw.height, channels: 4 } })
          .resize(dstW, dstH, { fit: "fill" })
          .raw()
          .toBuffer({ resolveWithObject: true });
        resized.push(data);
      }
      assets.push({ frames: resized, width: dstW, height: dstH });
    } else {
      assets.push(raw);
    }
  }
  process.stdout.write("\n");
  return assets;
}

async function renderSegments(
  assets: LoadedAsset[],
  segFile: MosaicSegmentsFile,
  output: string,
  opts: { fps?: number; duration?: number; format?: "mp4" | "gif" },
): Promise<void> {
  const { width, height, segments: allSegments, fps: fileFps } = segFile;
  const fps = opts.fps ?? fileFps ?? 24;
  const format = opts.format ?? "mp4";
  const totalFrames = Math.round((opts.duration ?? 5) * fps);

  const assetAvgColors: Array<[number, number, number]> = assets.map(a => {
    const mid = a.frames[Math.floor(a.frames.length / 2)];
    return avgColor(mid, a.width, a.height);
  });
  const scheduler = new AssetScheduler(assetAvgColors, fps);

  console.log(`Rendering ${totalFrames} frames (${width}×${height}, ${fps}fps)...`);
  const stream = openVideoStream(width, height, fps, format, output);

  for (let f = 0; f < totalFrames; f++) {
    const segments = allSegments[f % allSegments.length];

    const compositeInputs: sharp.OverlayOptions[] = await mapConcurrent(
      segments, 2, async (seg) => {
        const assetIdx = scheduler.getAssetIdx(seg.clusterId, seg.color, f);
        const asset = assets[assetIdx];
        const frameIdx = f % asset.frames.length;
        const srcBuf = asset.frames[frameIdx];

        const tileW = Math.max(1, Math.min(Math.round(seg.width), width));
        const tileH = Math.max(1, Math.min(Math.round(seg.height), height));
        let tilePipeline = sharp(srcBuf, {
          raw: { width: asset.width, height: asset.height, channels: 4 },
        }).resize(tileW, tileH, { fit: "fill" });

        let tileWidth = tileW;
        let tileHeight = tileH;

        if (seg.angle !== 0) {
          let rotPipeline = tilePipeline
            .rotate(seg.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .ensureAlpha();

          const radians = Math.abs(seg.angle * Math.PI / 180);
          const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
          const rotW = Math.ceil(tileW * cos + tileH * sin);
          const rotH = Math.ceil(tileW * sin + tileH * cos);
          if (rotW > width || rotH > height) {
            const scale = Math.min(width / rotW, height / rotH);
            rotPipeline = rotPipeline.resize(Math.max(1, Math.floor(rotW * scale)), Math.max(1, Math.floor(rotH * scale))) as typeof rotPipeline;
          }

          const { data: rotated, info: rotInfo } = await rotPipeline.raw().toBuffer({ resolveWithObject: true });
          tileWidth = rotInfo.width;
          tileHeight = rotInfo.height;

          return {
            input: Buffer.from(rotated.buffer),
            raw: { width: tileWidth, height: tileHeight, channels: 4 as const },
            left: Math.round(seg.cx - tileWidth / 2),
            top: Math.round(seg.cy - tileHeight / 2),
          };
        } else {
          const { data: tile } = await tilePipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          return {
            input: Buffer.from(tile.buffer),
            raw: { width: tileWidth, height: tileHeight, channels: 4 as const },
            left: Math.round(seg.cx - tileWidth / 2),
            top: Math.round(seg.cy - tileHeight / 2),
          };
        }
      }
    );

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
    if ((f + 1) % 10 === 0 || f === totalFrames - 1)
      process.stdout.write(`\r  ${f+1}/${totalFrames} frames composed`);
  }
  process.stdout.write("\n");
  process.stdout.write("Finalizing video...\n");
  await stream.close();
  console.log(`Mosaic rendered → ${output}`);
}

export async function mosaicRenderCommand(opts: MosaicRenderOptions): Promise<void> {
  const segFile: MosaicSegmentsFile = JSON.parse((await readFile(opts.segments)).toString());
  console.log(`Loading assets from ${opts.assets}...`);
  const assets = await loadAssets(opts.assets);
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
