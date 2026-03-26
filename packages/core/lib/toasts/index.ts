import * as HueNoise from "./hue-noise.toast";
import * as HueScan from "./hue-scan.toast";
import * as HueCycle from "./hue-cycle.toast";
import * as MosaicSegment from "./mosaic-segment.toast";

export type ToastOutput =
  | { type: "image"; data: Uint8ClampedArray }
  | { type: "video"; path: string }
  | { type: "frames"; frames: Uint8ClampedArray[]; fps: number; format: "mp4" | "gif" };

export type ToastMeta = {
  slug: string;
  name: string;
  description?: string;
  outputType: "image" | "video";
};

export type ProgressFn = (current: number, total: number, label?: string) => void;

export type BakeFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params?: Record<string, unknown>,
  outputPath?: string,
  onProgress?: ProgressFn,
) => ToastOutput | Promise<ToastOutput>;

export interface Toast {
  meta: ToastMeta;
  bake: BakeFn;
}

export { HueNoise, HueScan, HueCycle, MosaicSegment };

export const toasts: Record<string, Toast> = {
  "hue-noise": HueNoise as unknown as Toast,
  "hue-scan": HueScan as unknown as Toast,
  "hue-cycle": HueCycle as unknown as Toast,
  "mosaic-segment": MosaicSegment as unknown as Toast,
};
