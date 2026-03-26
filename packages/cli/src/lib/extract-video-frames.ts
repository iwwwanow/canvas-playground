import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

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

export function probeDuration(filePath: string): Promise<number> {
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
      const m = out.match(/duration=([\d.]+)/);
      resolve(m ? parseFloat(m[1]) : 10);
    });
  });
}

export interface VideoFrame {
  index: number;
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Extract all frames from a video at the given fps.
 *  Calls onFrame for each frame so memory stays bounded.
 */
export async function extractFrames(
  videoPath: string,
  fps: number,
  onFrame: (frame: VideoFrame) => Promise<void>,
): Promise<{ width: number; height: number; totalFrames: number }> {
  const tmpDir = join(tmpdir(), `toast-vframes-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    await runFfmpeg([
      "-i", videoPath,
      "-vf", `fps=${fps}`,
      join(tmpDir, "frame_%05d.png"),
    ]);

    const files = (await readdir(tmpDir)).filter(f => f.endsWith(".png")).sort();
    if (files.length === 0) throw new Error("No frames extracted from video");

    const firstMeta = await sharp(join(tmpDir, files[0])).metadata();
    const width = firstMeta.width ?? 640;
    const height = firstMeta.height ?? 360;

    for (let i = 0; i < files.length; i++) {
      const { data } = await sharp(join(tmpDir, files[i]))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      await onFrame({ index: i, data: new Uint8ClampedArray(data.buffer), width, height });
    }

    return { width, height, totalFrames: files.length };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
