import { mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

// ── Bezier evaluation (mirrors sandbox/src/lib/bezier.ts) ──────────────────

interface Vec2 { x: number; y: number; }

interface SpeedKeyframe {
  frame: number;
  value: number;
  handleIn: Vec2;
  handleOut: Vec2;
}

function cubic(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function solveT(targetX: number, x0: number, x1: number, x2: number, x3: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (cubic(mid, x0, x1, x2, x3) < targetX) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function evaluateCurve(frame: number, kfs: SpeedKeyframe[]): number {
  if (kfs.length === 0) return 1;
  if (frame <= kfs[0].frame) return kfs[0].value;
  if (frame >= kfs[kfs.length - 1].frame) return kfs[kfs.length - 1].value;
  let i = 0;
  while (i < kfs.length - 2 && kfs[i + 1].frame <= frame) i++;
  const k0 = kfs[i], k1 = kfs[i + 1];
  const t = solveT(frame, k0.frame, k0.handleOut.x, k1.handleIn.x, k1.frame);
  return cubic(t, k0.value, k0.handleOut.y, k1.handleIn.y, k1.value);
}

function autoHandles(kfs: SpeedKeyframe[]): SpeedKeyframe[] {
  return kfs.map((kf, i) => {
    const prev = kfs[i - 1];
    const next = kfs[i + 1];
    let slope = 0;
    if (prev && next) slope = (next.value - prev.value) / (next.frame - prev.frame);
    else if (next) slope = (next.value - kf.value) / (next.frame - kf.frame);
    else if (prev) slope = (kf.value - prev.value) / (kf.frame - prev.frame);
    const outX = next ? kf.frame + (next.frame - kf.frame) / 3 : kf.frame;
    const inX  = prev ? kf.frame - (kf.frame - prev.frame) / 3 : kf.frame;
    return {
      ...kf,
      handleOut: { x: outX, y: kf.value + slope * (outX - kf.frame) },
      handleIn:  { x: inX,  y: kf.value + slope * (inX  - kf.frame) },
    };
  });
}

// ── ffprobe / ffmpeg helpers ───────────────────────────────────────────────

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

function probeVideo(filePath: string): Promise<{ duration: number; fps: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v", "quiet",
      "-select_streams", "v:0",
      "-show_entries", "stream=r_frame_rate:format=duration",
      "-of", "default=noprint_wrappers=1",
      filePath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => (out += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffprobe failed"));
      const durMatch = out.match(/duration=([\d.]+)/);
      const fpsMatch = out.match(/r_frame_rate=(\d+)\/(\d+)/);
      const duration = durMatch ? parseFloat(durMatch[1]) : 10;
      let fps = 24;
      if (fpsMatch) {
        const num = parseInt(fpsMatch[1]), den = parseInt(fpsMatch[2]);
        if (den > 0) fps = Math.round((num / den) * 100) / 100;
      }
      resolve({ duration, fps });
    });
  });
}

// ── curve loading ──────────────────────────────────────────────────────────

interface SpeedCurve {
  curveFps: number;
  keyframes: SpeedKeyframe[];
}

/** Parse inline format: "frame:speed,frame:speed,..." with auto bezier handles */
function parseInlineCurve(s: string, curveFps: number): SpeedCurve {
  const raw = s.split(",").map(pair => {
    const [f, v] = pair.trim().split(":").map(Number);
    if (isNaN(f) || isNaN(v)) throw new Error(`Bad pair in curve: "${pair}"`);
    return { frame: f, value: v, handleIn: { x: f, y: v }, handleOut: { x: f, y: v } };
  });
  raw.sort((a, b) => a.frame - b.frame);
  return { curveFps, keyframes: autoHandles(raw) };
}

async function loadCurve(curveArg: string, curveFps: number): Promise<SpeedCurve> {
  // Looks like a file path if it ends with .json or contains path separators
  if (curveArg.endsWith(".json") || curveArg.includes("/") || curveArg.includes("\\")) {
    const raw = JSON.parse((await readFile(curveArg)).toString()) as SpeedCurve;
    return raw;
  }
  return parseInlineCurve(curveArg, curveFps);
}

// ── main command ───────────────────────────────────────────────────────────

export interface SpeedRemapOptions {
  input: string;
  output: string;
  curve: string;          // JSON file path OR inline "frame:speed,frame:speed,..."
  curveFps?: number;      // fps for X axis when using inline curve (default 24)
  outFps?: number;        // output fps (default: same as input)
  outDuration?: number;   // max output duration in seconds (default: until input exhausted)
}

export async function speedRemapCommand(opts: SpeedRemapOptions): Promise<void> {
  console.log(`Probing ${opts.input}...`);
  const { duration: inDuration, fps: inFps } = await probeVideo(opts.input);
  const outFps = opts.outFps ?? Math.round(inFps);
  console.log(`Input: ${inDuration.toFixed(2)}s @ ${inFps}fps  →  output @ ${outFps}fps`);

  const curve = await loadCurve(opts.curve, opts.curveFps ?? 24);
  console.log(`Curve: ${curve.keyframes.length} keyframes @ curveFps=${curve.curveFps}`);

  const tmpDir = join(tmpdir(), `toast-speedremap-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    // Extract all input frames sequentially (friendly to slow machines)
    console.log(`Extracting frames at ${inFps}fps...`);
    await runFfmpeg([
      "-i", opts.input,
      "-vf", `fps=${inFps}`,
      join(tmpDir, "frame_%06d.png"),
    ]);

    const frameFiles = readdirSync(tmpDir)
      .filter(f => f.endsWith(".png"))
      .sort()
      .map(f => join(tmpDir, f));

    const totalInputFrames = frameFiles.length;
    console.log(`Extracted ${totalInputFrames} input frames`);

    // Build output frame sequence by integrating the speed curve.
    //
    // Speed curve semantics:
    //   X = output time in curve-frames (at curveFps)
    //   Y = playback speed (1.0=normal, 2.0=2x faster, 0.5=half speed)
    //
    // For each output frame step dt = 1/outFps:
    //   speed = curve(outFrame * outFps / curveFps)  ← convert to curve-frame coords
    //   tIn  += speed * dt                            ← advance input time
    //   frameIn = round(tIn * inFps)                 ← pick source frame

    const frameInterval = 1 / outFps;
    const maxOutDuration = opts.outDuration ?? inDuration * 8; // safety cap
    const concatLines: string[] = ["ffconcat version 1.0"];
    let tIn = 0;
    let outFrameCount = 0;

    while (tIn < inDuration && outFrameCount * frameInterval < maxOutDuration) {
      const tOut = outFrameCount * frameInterval;
      const curveFrame = tOut * curve.curveFps;
      const speed = Math.max(0.01, evaluateCurve(curveFrame, curve.keyframes));

      const frameIn = Math.min(Math.round(tIn * inFps), totalInputFrames - 1);
      concatLines.push(`file '${frameFiles[frameIn]}'`);
      concatLines.push(`duration ${frameInterval.toFixed(6)}`);

      tIn += speed * frameInterval;
      outFrameCount++;

      if (outFrameCount % 50 === 0) {
        process.stdout.write(
          `\r  ${outFrameCount} frames  t_in=${tIn.toFixed(2)}s / ${inDuration.toFixed(2)}s`,
        );
      }
    }
    process.stdout.write(`\r  ${outFrameCount} frames total\n`);

    const concatPath = join(tmpDir, "concat.txt");
    writeFileSync(concatPath, concatLines.join("\n"));

    // Encode output
    console.log(`Encoding → ${opts.output}...`);
    const isGif = opts.output.endsWith(".gif");
    const encodeArgs = isGif
      ? [
          "-f", "concat", "-safe", "0", "-i", concatPath,
          "-vf", `fps=${outFps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=sierra2_4a`,
          opts.output,
        ]
      : [
          "-f", "concat", "-safe", "0", "-i", concatPath,
          "-c:v", "libx264", "-pix_fmt", "yuv420p",
          "-r", String(outFps),
          opts.output,
        ];

    await runFfmpeg(encodeArgs);
    console.log(`Done → ${opts.output}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
