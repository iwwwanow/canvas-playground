import { mkdirSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { MosaicSegment } from "@xtc-toaster/core";
import type { Segment } from "@xtc-toaster/core";
import { scanAssetsDir, loadAsset } from "../lib/extract-asset-frames.js";
import { assembleVideo } from "../lib/assemble-video.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MosaicSegmentsFile {
  width: number;
  height: number;
  segments: Segment[];
}

// ─── mosaic segment ─────────────────────────────────────────────────────────

export interface MosaicSegmentOptions {
  input: string;
  output: string;
  cellSize?: number;
  k?: number;
}

export async function mosaicSegmentCommand(opts: MosaicSegmentOptions): Promise<void> {
  const cellSize = opts.cellSize ?? 32;
  const k = opts.k ?? 8;

  console.log(`Loading ${opts.input}...`);
  const { data, info } = await sharp(opts.input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelData = new Uint8ClampedArray(data.buffer);
  const params = { cellSize, k, iterations: 20 };

  console.log(`Segmenting ${info.width}×${info.height} (cellSize=${cellSize}, k=${k})...`);
  const segments = MosaicSegment.segment(pixelData, info.width, info.height, params);

  // Ensure output dir exists
  const { mkdirSync: mkdir } = await import("node:fs");
  mkdir(opts.output, { recursive: true });

  // Save segments JSON
  const segmentsFile: MosaicSegmentsFile = {
    width: info.width,
    height: info.height,
    segments,
  };
  const jsonPath = join(opts.output, "segments.json");
  await writeFile(jsonPath, JSON.stringify(segmentsFile, null, 2));
  console.log(`Segments saved → ${jsonPath} (${segments.length} rectangles, ${k} clusters)`);

  // Save debug visualization
  const debugOutput = MosaicSegment.bake(pixelData, info.width, info.height, params);
  if (debugOutput.type === "image") {
    const debugPath = join(opts.output, "debug.png");
    await sharp(Buffer.from(debugOutput.data.buffer), {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png().toFile(debugPath);
    console.log(`Debug image saved → ${debugPath}`);
  }
}

// ─── mosaic render ───────────────────────────────────────────────────────────

export interface MosaicRenderOptions {
  segments: string;        // path to segments.json
  assets: string;          // path to assets dir
  output: string;          // output mp4/gif path
  duration?: number;       // seconds (default 5)
  fps?: number;            // default 24
  format?: "mp4" | "gif";
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/** Assign each cluster an asset index by color similarity. */
function assignAssetsToSegments(
  segments: Segment[],
  assetAvgColors: Array<[number, number, number]>,
): Map<number, number> {
  // Collect unique clusters
  const clusters = new Map<number, [number, number, number]>();
  for (const seg of segments) {
    if (!clusters.has(seg.clusterId)) clusters.set(seg.clusterId, seg.color);
  }

  const assignment = new Map<number, number>();
  for (const [clusterId, clusterColor] of clusters) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < assetAvgColors.length; i++) {
      const d = colorDist(clusterColor, assetAvgColors[i]);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    assignment.set(clusterId, best);
  }
  return assignment;
}

/** Compute the average RGBA color of raw RGBA buffer. */
function avgColor(buf: Buffer, w: number, h: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const pixels = w * h;
  for (let i = 0; i < buf.length; i += 4) {
    r += buf[i]; g += buf[i + 1]; b += buf[i + 2];
  }
  return [r / pixels, g / pixels, b / pixels];
}

export async function mosaicRenderCommand(opts: MosaicRenderOptions): Promise<void> {
  const duration = opts.duration ?? 5;
  const fps = opts.fps ?? 24;
  const format = opts.format ?? "mp4";
  const totalFrames = Math.round(duration * fps);

  // Load segments
  console.log(`Loading segments from ${opts.segments}...`);
  const segFile: MosaicSegmentsFile = JSON.parse(
    (await readFile(opts.segments)).toString()
  );
  const { width, height, segments } = segFile;

  // Scan and load assets
  console.log(`Scanning assets in ${opts.assets}...`);
  const assetPaths = await scanAssetsDir(opts.assets);
  if (assetPaths.length === 0) {
    console.error("No assets found in assets dir.");
    process.exit(1);
  }
  console.log(`Found ${assetPaths.length} asset(s). Extracting frames...`);

  const maxFrames = Math.max(totalFrames, 48);
  const assets = await Promise.all(
    assetPaths.map(async (p, i) => {
      process.stdout.write(`\r  Loading asset ${i + 1}/${assetPaths.length}...`);
      return loadAsset(p, maxFrames);
    })
  );
  process.stdout.write("\n");

  // Compute average color for each asset (from middle frame)
  const assetAvgColors: Array<[number, number, number]> = assets.map(a => {
    const mid = a.frames[Math.floor(a.frames.length / 2)];
    return avgColor(mid, a.width, a.height);
  });

  // Assign assets to clusters
  const clusterToAsset = assignAssetsToSegments(segments, assetAvgColors);

  console.log(`Rendering ${totalFrames} frames (${width}×${height}, ${fps}fps)...`);

  const outputFrames: Uint8ClampedArray[] = [];

  for (let f = 0; f < totalFrames; f++) {
    // Build composite inputs for all segments
    const compositeInputs = await Promise.all(
      segments.map(async (seg) => {
        const assetIdx = clusterToAsset.get(seg.clusterId) ?? 0;
        const asset = assets[assetIdx];
        const frameIdx = f % asset.frames.length;
        const srcBuf = asset.frames[frameIdx];

        // Resize source frame to tile dimensions
        const { data: resized } = await sharp(srcBuf, {
          raw: { width: asset.width, height: asset.height, channels: 4 },
        })
          .resize(seg.width, seg.height, { fit: "fill" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        return {
          input: Buffer.from(resized.buffer),
          raw: { width: seg.width, height: seg.height, channels: 4 as const },
          left: seg.x,
          top: seg.y,
        };
      })
    );

    // Composite all tiles onto a black canvas
    const { data: frameData } = await sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .composite(compositeInputs)
      .raw()
      .toBuffer({ resolveWithObject: true });

    outputFrames.push(new Uint8ClampedArray(frameData.buffer));

    if ((f + 1) % 10 === 0 || f === totalFrames - 1) {
      process.stdout.write(`\r  ${f + 1}/${totalFrames} frames composed`);
    }
  }
  process.stdout.write("\n");

  console.log(`Assembling ${format.toUpperCase()}...`);
  await assembleVideo(outputFrames, width, height, fps, format, opts.output);
  console.log(`Mosaic rendered → ${opts.output}`);
}
