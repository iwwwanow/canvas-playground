import { spawn } from "node:child_process";

export interface VideoStream {
  writeFrame(data: Uint8ClampedArray): Promise<void>;
  close(): Promise<void>;
}

/** Assemble an array of RGBA frames into a video file. */
export async function assembleVideo(
  frames: Uint8ClampedArray[],
  width: number,
  height: number,
  fps: number,
  format: "mp4" | "gif",
  outputPath: string,
): Promise<void> {
  const stream = openVideoStream(width, height, fps, format, outputPath);
  for (const frame of frames) {
    await stream.writeFrame(frame);
  }
  await stream.close();
}

/** Open an ffmpeg stdin-pipe that accepts raw RGBA frames. */
export function openVideoStream(
  width: number,
  height: number,
  fps: number,
  format: "mp4" | "gif",
  outputPath: string,
): VideoStream {
  // libx264 requires even dimensions
  const w = width % 2 === 0 ? width : width + 1;
  const h = height % 2 === 0 ? height : height + 1;

  const args = format === "mp4"
    ? [
        "-f", "rawvideo", "-pix_fmt", "rgba",
        "-s", `${width}x${height}`,
        "-r", String(fps),
        "-i", "pipe:0",
        "-vf", `pad=${w}:${h}`,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        outputPath,
      ]
    : [
        "-f", "rawvideo", "-pix_fmt", "rgba",
        "-s", `${width}x${height}`,
        "-r", String(fps),
        "-i", "pipe:0",
        "-vf", `fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        outputPath,
      ];

  const proc = spawn("ffmpeg", ["-y", ...args], { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

  const finished = new Promise<void>((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}:\n${stderr.slice(-500)}`));
    });
  });

  return {
    async writeFrame(data: Uint8ClampedArray): Promise<void> {
      const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      const ok = proc.stdin!.write(buf);
      if (!ok) {
        await new Promise<void>((resolve) => proc.stdin!.once("drain", resolve));
      }
    },
    async close(): Promise<void> {
      proc.stdin!.end();
      await finished;
    },
  };
}
