import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

function ffmpeg(args: string[]): Promise<void> {
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

export async function assembleVideo(
  frames: Uint8ClampedArray[],
  width: number,
  height: number,
  fps: number,
  format: "mp4" | "gif",
  outputPath: string,
): Promise<void> {
  const tmpDir = join(tmpdir(), `toast-frames-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    process.stdout.write(`Rendering ${frames.length} frames`);
    for (let i = 0; i < frames.length; i++) {
      const framePath = join(tmpDir, `frame_${String(i).padStart(5, "0")}.png`);
      await sharp(Buffer.from(frames[i].buffer), {
        raw: { width, height, channels: 4 },
      }).png().toFile(framePath);
      if ((i + 1) % 30 === 0 || i === frames.length - 1)
        process.stdout.write(`\r${i + 1}/${frames.length} frames written`);
    }
    process.stdout.write(`\nEncoding ${format.toUpperCase()}...\n`);

    // libx264 requires even dimensions
    const w = width % 2 === 0 ? width : width + 1;
    const h = height % 2 === 0 ? height : height + 1;

    if (format === "mp4") {
      await ffmpeg([
        "-framerate", String(fps),
        "-i", join(tmpDir, "frame_%05d.png"),
        "-vf", `pad=${w}:${h}`,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        outputPath,
      ]);
    } else {
      await ffmpeg([
        "-framerate", String(fps),
        "-i", join(tmpDir, "frame_%05d.png"),
        "-vf", `fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        outputPath,
      ]);
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
