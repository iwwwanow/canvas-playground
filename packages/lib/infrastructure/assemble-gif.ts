import { spawn } from "node:child_process";
import type { ImageRawDataArray } from "../domain/types";

async function pipeFrames(
  frames: ImageRawDataArray[],
  width: number,
  height: number,
  fps: number,
  args: string[]
): Promise<void> {
  const proc = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

  const finished = new Promise<void>((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}:\n${stderr.slice(-800)}`));
    });
  });

  for (const frame of frames) {
    const buf = Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength);
    const ok = proc.stdin!.write(buf);
    if (!ok) {
      await new Promise<void>((resolve) => proc.stdin!.once("drain", resolve));
    }
  }

  proc.stdin!.end();
  await finished;
}

export function assembleGif(
  frames: ImageRawDataArray[],
  width: number,
  height: number,
  fps: number,
  outputPath: string
): Promise<void> {
  const args = [
    "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-s", `${width}x${height}`,
    "-r", String(fps),
    "-i", "pipe:0",
    "-vf", `fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=sierra2_4a`,
    outputPath,
  ];
  return pipeFrames(frames, width, height, fps, args);
}

export function assembleVideo(
  frames: ImageRawDataArray[],
  width: number,
  height: number,
  fps: number,
  outputPath: string
): Promise<void> {
  // libx264 requires even dimensions
  const w = width % 2 === 0 ? width : width + 1;
  const h = height % 2 === 0 ? height : height + 1;
  const args = [
    "-y",
    "-f", "rawvideo", "-pix_fmt", "rgba",
    "-s", `${width}x${height}`,
    "-r", String(fps),
    "-i", "pipe:0",
    "-vf", `pad=${w}:${h}`,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    outputPath,
  ];
  return pipeFrames(frames, width, height, fps, args);
}
