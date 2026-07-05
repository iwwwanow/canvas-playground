import sharp from "sharp";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { mapConcurrent } from "./concurrent.js";

const VIDEO_EXTS = new Set([".mp4", ".webm", ".avi", ".mov", ".mkv"]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tiff"]);

export interface AssetFrames {
  /** Raw RGBA buffers, one per frame */
  frames: Buffer[];
  width: number;
  height: number;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}:\n${stderr.slice(-500)}`));
    });
  });
}

function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "quiet",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1",
      filePath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => (out += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffprobe failed"));
      const match = out.match(/duration=([\d.]+)/);
      resolve(match ? parseFloat(match[1]) : 10);
    });
  });
}

async function extractVideoFrames(filePath: string, maxFrames: number): Promise<AssetFrames> {
  const tmpDir = join(tmpdir(), `toast-asset-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    const duration = await probeDuration(filePath);
    const fps = Math.min(maxFrames / duration, 24);

    await runFfmpeg([
      "-i", filePath,
      "-vf", `fps=${fps.toFixed(4)}`,
      "-frames:v", String(maxFrames),
      join(tmpDir, "frame_%04d.png"),
    ]);

    const files = (await readdir(tmpDir)).filter(f => f.endsWith(".png")).sort();
    if (files.length === 0) throw new Error(`No frames extracted from ${filePath}`);

    const first = await sharp(join(tmpDir, files[0])).metadata();
    const { width = 640, height = 360 } = first;

    const results = await mapConcurrent(files, 4, (f) =>
      sharp(join(tmpDir, f))
        .ensureAlpha()
        .raw()
        .toBuffer()
        .catch(() => null)
    );
    const frames = results.filter((b): b is Buffer => b !== null);
    if (frames.length === 0) throw new Error(`All frames corrupted in ${filePath}`);

    return { frames, width, height };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function extractGifFrames(filePath: string, maxFrames: number): Promise<AssetFrames> {
  const meta = await sharp(filePath).metadata();
  const pageCount = meta.pages ?? 1;
  const { width = 100, height = 100 } = meta;

  const step = Math.max(1, Math.floor(pageCount / maxFrames));
  const indices: number[] = [];
  for (let i = 0; i < pageCount && indices.length < maxFrames; i += step) {
    indices.push(i);
  }

  const frames = await mapConcurrent(indices, 4, (page) =>
    sharp(filePath, { page })
      .ensureAlpha()
      .raw()
      .toBuffer()
  );

  return { frames, width, height };
}

async function loadImageFrame(filePath: string): Promise<AssetFrames> {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { frames: [data], width: info.width, height: info.height };
}

/** Load a media file and return its frames as raw RGBA buffers. */
export async function extractAssetFrames(
  filePath: string,
  maxFrames = 48,
): Promise<AssetFrames> {
  const ext = extname(filePath).toLowerCase();

  if (VIDEO_EXTS.has(ext)) return extractVideoFrames(filePath, maxFrames);
  if (ext === ".gif") return extractGifFrames(filePath, maxFrames);
  if (IMAGE_EXTS.has(ext)) return loadImageFrame(filePath);

  throw new Error(`Unsupported asset format: ${ext}`);
}

/** Scan a directory recursively for usable media assets (images, videos, gifs, or subdirs with PNGs). */
export async function scanAssetsDir(assetsDir: string): Promise<string[]> {
  const ALL_EXTS = new Set([...VIDEO_EXTS, ...IMAGE_EXTS, ".gif"]);
  const paths: string[] = [];

  async function scan(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile());
    const subdirs = entries.filter(e => e.isDirectory());

    // Check if this dir is a PNG sequence
    const hasPngs = files.some(f => extname(f.name).toLowerCase() === ".png");
    if (hasPngs) {
      paths.push(dir + "/");
      return; // don't recurse into PNG sequence dirs
    }

    for (const file of files) {
      if (ALL_EXTS.has(extname(file.name).toLowerCase())) {
        paths.push(join(dir, file.name));
      }
    }

    for (const sub of subdirs) {
      await scan(join(dir, sub.name));
    }
  }

  await scan(assetsDir);
  return paths;
}

/** Load a PNG-sequence directory as frames. */
export async function extractSequenceDir(dirPath: string, maxFrames: number): Promise<AssetFrames> {
  const dir = dirPath.endsWith("/") ? dirPath.slice(0, -1) : dirPath;
  const files = (await readdir(dir))
    .filter(f => extname(f).toLowerCase() === ".png")
    .sort()
    .slice(0, maxFrames);

  if (files.length === 0) throw new Error(`No PNGs found in ${dir}`);

  const first = await sharp(join(dir, files[0])).metadata();
  const { width = 100, height = 100 } = first;

  const frames = await mapConcurrent(files, 4, (f) =>
    sharp(join(dir, f)).ensureAlpha().raw().toBuffer()
  );

  return { frames, width, height };
}

/** Unified loader: handles sequence dirs (trailing slash) and regular files. */
export async function loadAsset(assetPath: string, maxFrames = 48): Promise<AssetFrames> {
  if (assetPath.endsWith("/")) return extractSequenceDir(assetPath, maxFrames);
  return extractAssetFrames(assetPath, maxFrames);
}
