import { cutHue } from "../cutters";
import { Layer } from "../classes/layer.class";
import { LayerEffect } from "../classes/layer.interfaces";
import { alphaCompose } from "../composers/alpha.composer";
import { applyYRotationPerspective } from "../transforms/y-rotation";
import type { ToastOutput, ProgressFn } from "./index";

export interface HueCycleChannel {
  min: number;    // hue range start (0–359)
  max: number;    // hue range end (0–359)
  step: number;   // hue advance per frame
  noize: number;  // noise coefficient (0–1)
  frames: number; // Y-rotation cycle length in frames
}

export interface HueCycleParams {
  channels?: HueCycleChannel[];
  totalFrames?: number;  // how many frames to render (default: lcm of all channel.frames)
  fps?: number;          // default 30
  format?: "mp4" | "gif"; // default "mp4"
  yMaxAngle?: number;    // max Y-rotation angle in radians (default Math.PI * 0.05)
  focalLength?: number;  // perspective focal length (default 600)
}

// Defaults exactly matching composition-6
const DEFAULT_CHANNELS: HueCycleChannel[] = [
  { min: 320, max: 350, step: 0.5,   noize: 0.05, frames: 30  },
  { min: 8,   max: 32,  step: 0.25,  noize: 0.01, frames: 48  },
  { min: 120, max: 200, step: 0.667, noize: 0.05, frames: 60  },
  { min: 40,  max: 120, step: 0.667, noize: 0.05, frames: 60  },
  { min: 200, max: 240, step: 0.333, noize: 0.08, frames: 120 },
];

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

function toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const l = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    out[i] = out[i + 1] = out[i + 2] = l;
    out[i + 3] = data[i + 3];
  }
  return out;
}

export const meta = {
  slug: "hue-cycle",
  name: "Hue Cycle",
  description:
    "Multi-channel hue animation with grayscale base and Y-rotation perspective. Matches composition-6.",
  outputType: "video" as const,
};

export function bake(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: HueCycleParams = {},
  _outputPath?: string,
  onProgress?: ProgressFn,
): ToastOutput {
  const {
    channels = DEFAULT_CHANNELS,
    fps = 30,
    format = "mp4",
    yMaxAngle = Math.PI * 0.05,
    focalLength = 600,
  } = params;

  // Default totalFrames = LCM of all channel.frames (one full cycle of every channel)
  const totalFrames =
    params.totalFrames ?? channels.map((c) => c.frames).reduce(lcm);

  // Grayscale base — computed once
  const grayscaleData = toGrayscale(data);

  // Per-channel state
  const hues = channels.map((c) => c.min as number);
  const rotFrames = channels.map(() => 0);

  const frames: Uint8ClampedArray[] = [];

  for (let f = 0; f < totalFrames; f++) {
    // Start with grayscale base
    let composite = new Uint8ClampedArray(grayscaleData);

    channels.forEach(({ min, max, step, noize, frames: cycleFrames }, i) => {
      const range = (max - min + 360) % 360;
      const hue = Math.round(hues[i]) % 360;

      // Sawtooth Y-rotation: 0 → yMaxAngle, reset every cycleFrames
      const t = (rotFrames[i] % cycleFrames) / cycleFrames;
      const yAngle = t * yMaxAngle;
      rotFrames[i]++;

      const hueData = cutHue(data, hue);
      const layer = new Layer(hueData);
      layer.addEffect(LayerEffect.Noize, {
        deviationCoefficient: noize,
        preserveAlpha: true,
      });

      const rotated = applyYRotationPerspective(
        layer.data,
        width,
        height,
        yAngle,
        focalLength,
      );

      composite = alphaCompose(composite, rotated);

      hues[i] = min + ((hues[i] - min + step) % range);
    });

    frames.push(composite);
    onProgress?.(f + 1, totalFrames, "computing frames");
  }

  return { type: "frames", frames, fps, format };
}
