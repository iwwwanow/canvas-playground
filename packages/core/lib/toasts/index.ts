import * as HueNoise from "./hue-noise.toast";

export type ToastMeta = { slug: string; name: string; description?: string };

export type BakeFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params?: Record<string, unknown>,
) => Uint8ClampedArray;

export interface Toast {
  meta: ToastMeta;
  bake: BakeFn;
}

export { HueNoise };

export const toasts: Record<string, Toast> = {
  "hue-noise": HueNoise as unknown as Toast,
};
