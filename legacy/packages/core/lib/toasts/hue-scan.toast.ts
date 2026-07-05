import { cutHue } from "../cutters";
import { Layer } from "../classes/layer.class";
import { LayerEffect } from "../classes/layer.interfaces";
import { alphaCompose } from "../composers/alpha.composer";
import { hexToRgb } from "../utils";
import type { ToastOutput } from "./index";

export interface HueScanParams {
  hue?: number;            // 0–359, default 0
  noizeDeviation?: number; // 0–1, default 0.3
  background?: string;     // hex color, default "#ffffff"
}

export const meta = {
  slug: "hue-scan",
  name: "Hue Scan",
  description: "Cuts a hue slice with noise composited on a solid background",
  outputType: "image" as const,
};

export function bake(
  data: Uint8ClampedArray,
  _width: number,
  _height: number,
  params: HueScanParams = {},
): ToastOutput {
  const { hue = 0, noizeDeviation = 0.3, background = "#ffffff" } = params;

  const [r, g, b] = hexToRgb(background as `#${string}`);
  const bgData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < bgData.length; i += 4) {
    bgData[i]     = r;
    bgData[i + 1] = g;
    bgData[i + 2] = b;
    bgData[i + 3] = 255;
  }

  const hueData = cutHue(data, hue);
  const layer = new Layer(hueData);
  layer.addEffect(LayerEffect.Noize, {
    deviationCoefficient: noizeDeviation,
    preserveAlpha: false,
  });

  const result = alphaCompose(bgData, layer.data);

  return { type: "image", data: result };
}
