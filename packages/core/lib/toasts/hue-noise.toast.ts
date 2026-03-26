import { cutHue } from "../cutters";
import { Layer } from "../classes/layer.class";
import { LayerEffect } from "../classes/layer.interfaces";
import type { ToastOutput } from "./index";

export interface HueNoiseParams {
  hue?: number;            // 0–359, default 0
  noizeDeviation?: number; // 0–1, default 0.3
}

export const meta = {
  slug: "hue-noise",
  name: "Hue Noise",
  description: "Cuts a hue slice and adds chromatic noise",
  outputType: "image" as const,
};

export function bake(
  data: Uint8ClampedArray,
  _width: number,
  _height: number,
  params: HueNoiseParams = {},
): ToastOutput {
  const { hue = 0, noizeDeviation = 0.3 } = params;
  const hueData = cutHue(data, hue);
  const layer = new Layer(hueData);
  layer.addEffect(LayerEffect.Noize, {
    deviationCoefficient: noizeDeviation,
    preserveAlpha: false,
  });
  return { type: "image", data: layer.data };
}
