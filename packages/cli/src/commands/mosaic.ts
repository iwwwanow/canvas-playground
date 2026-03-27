import { mkdirSync, createWriteStream, unlinkSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { get as httpsGet } from "node:https";
import sharp from "sharp";
import { MosaicSegment } from "@xtc-toaster/core";
import type { Segment } from "@xtc-toaster/core";
import { scanAssetsDir, loadAsset } from "../lib/extract-asset-frames.js";
import { extractFrames } from "../lib/extract-video-frames.js";
import { assembleVideo } from "../lib/assemble-video.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MosaicSegmentsFile {
  width: number;
  height: number;
  fps: number;
  segments: Segment[];
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

  console.log(`Segmenting ${info.width}×${info.height} (cellSize=${params.cellSize}, k=${params.k})...`);
  const segments = MosaicSegment.segment(pixelData, info.width, info.height, params);

  mkdirSync(opts.output, { recursive: true });

  const file: MosaicSegmentsFile = { width: info.width, height: info.height, fps: 24, segments };
  const jsonPath = join(opts.output, "segments.json");
  await writeFile(jsonPath, JSON.stringify(file, null, 2));
  console.log(`Segments saved → ${jsonPath} (${segments.length} rects, ${params.k} clusters)`);

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

  let segments: Segment[] | null = null;
  let imgWidth = 0, imgHeight = 0;
  let frameCount = 0;

  console.log(`Extracting frames from ${opts.input} at ${fps}fps...`);
  const result = await extractFrames(opts.input, fps, async (frame) => {
    // Compute segments once from the first frame, reuse for all subsequent frames
    if (frame.index === 0) {
      imgWidth = frame.width;
      imgHeight = frame.height;
      process.stdout.write(`  Segmenting reference frame (${imgWidth}×${imgHeight})...`);
      segments = MosaicSegment.segment(frame.data, imgWidth, imgHeight, params);
      process.stdout.write(` ${segments.length} rectangles\n`);

      const file: MosaicSegmentsFile = { width: imgWidth, height: imgHeight, fps, segments };
      await writeFile(join(opts.output, "segments.json"), JSON.stringify(file, null, 2));
    }

    // Reuse cached segments — no recomputation
    const vizData = MosaicSegment.visualize(frame.data, imgWidth, imgHeight, segments!);
    const framePath = join(opts.output, `frame_${String(frame.index).padStart(5, "0")}.png`);
    await sharp(Buffer.from(vizData.buffer), {
      raw: { width: imgWidth, height: imgHeight, channels: 4 },
    }).png().toFile(framePath);

    frameCount++;
    if (frameCount % 10 === 0) {
      process.stdout.write(`\r  ${frameCount} frames rendered`);
    }
  });

  process.stdout.write(`\r  ${frameCount}/${result.totalFrames} frames rendered\n`);
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
    const url = `https://picsum.photos/seed/${seed}/640/360`;
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

function assignAssetsToSegments(
  segments: Segment[],
  assetAvgColors: Array<[number, number, number]>,
): Map<number, number> {
  const clusters = new Map<number, [number, number, number]>();
  for (const seg of segments) {
    if (!clusters.has(seg.clusterId)) clusters.set(seg.clusterId, seg.color);
  }
  const assignment = new Map<number, number>();
  for (const [clusterId, clusterColor] of clusters) {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < assetAvgColors.length; i++) {
      const d = colorDist(clusterColor, assetAvgColors[i]);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    assignment.set(clusterId, best);
  }
  return assignment;
}

function avgColor(buf: Buffer, w: number, h: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const pixels = w * h;
  for (let i = 0; i < buf.length; i += 4) { r += buf[i]; g += buf[i+1]; b += buf[i+2]; }
  return [r/pixels, g/pixels, b/pixels];
}

export async function mosaicRenderCommand(opts: MosaicRenderOptions): Promise<void> {
  const segFile: MosaicSegmentsFile = JSON.parse((await readFile(opts.segments)).toString());
  const { width, height, segments, fps: fileFps } = segFile;

  const fps = opts.fps ?? fileFps ?? 24;
  const format = opts.format ?? "mp4";
  const duration = opts.duration ?? 5;
  const totalFrames = Math.round(duration * fps);

  console.log(`Loading assets from ${opts.assets}...`);
  const assetPaths = await scanAssetsDir(opts.assets);
  if (assetPaths.length === 0) { console.error("No assets found."); process.exit(1); }

  console.log(`Found ${assetPaths.length} asset(s). Extracting frames...`);
  const maxFrames = Math.max(totalFrames, 48);
  const assets = await Promise.all(
    assetPaths.map(async (p, i) => {
      process.stdout.write(`\r  ${i+1}/${assetPaths.length}`);
      return loadAsset(p, maxFrames);
    })
  );
  process.stdout.write("\n");

  const assetAvgColors: Array<[number, number, number]> = assets.map(a => {
    const mid = a.frames[Math.floor(a.frames.length / 2)];
    return avgColor(mid, a.width, a.height);
  });

  const clusterToAsset = assignAssetsToSegments(segments, assetAvgColors);

  console.log(`Rendering ${totalFrames} frames (${width}×${height}, ${fps}fps)...`);
  const outputFrames: Uint8ClampedArray[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const compositeInputs: sharp.OverlayOptions[] = await Promise.all(
      segments.map(async (seg) => {
        const assetIdx = clusterToAsset.get(seg.clusterId) ?? 0;
        const asset = assets[assetIdx];
        const frameIdx = f % asset.frames.length;
        const srcBuf = asset.frames[frameIdx];

        // Resize to tile dimensions, then rotate if needed
        let tilePipeline = sharp(srcBuf, {
          raw: { width: asset.width, height: asset.height, channels: 4 },
        }).resize(seg.width, seg.height, { fit: "fill" });

        let tileWidth = seg.width;
        let tileHeight = seg.height;

        if (seg.angle !== 0) {
          // Rotate expands canvas to fit rotated rect
          const { data: rotated, info: rotInfo } = await tilePipeline
            .rotate(seg.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

          tileWidth = rotInfo.width;
          tileHeight = rotInfo.height;

          return {
            input: Buffer.from(rotated.buffer),
            raw: { width: tileWidth, height: tileHeight, channels: 4 as const },
            // Center on segment center
            left: Math.round(seg.cx - tileWidth / 2),
            top: Math.round(seg.cy - tileHeight / 2),
          };
        } else {
          const { data: tile } = await tilePipeline
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

          return {
            input: Buffer.from(tile.buffer),
            raw: { width: tileWidth, height: tileHeight, channels: 4 as const },
            left: seg.x,
            top: seg.y,
          };
        }
      })
    );

    const { data: frameData } = await sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .composite(compositeInputs)
      .raw()
      .toBuffer({ resolveWithObject: true });

    outputFrames.push(new Uint8ClampedArray(frameData.buffer));
    if ((f + 1) % 10 === 0 || f === totalFrames - 1)
      process.stdout.write(`\r  ${f+1}/${totalFrames} frames composed`);
  }
  process.stdout.write("\n");

  await assembleVideo(outputFrames, width, height, fps, format, opts.output);
  console.log(`Mosaic rendered → ${opts.output}`);
}
