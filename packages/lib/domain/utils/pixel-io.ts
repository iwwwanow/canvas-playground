import type { ImageRawDataArray, RgbaNormalizedPixel, RgbaPixel } from "../types";

// Internal helper, not part of the public utils barrel — domain-services need
// raw byte access without depending on the Color entity (services know only
// primitives).
export const readPixel = (data: ImageRawDataArray, pixelIndex: number): RgbaPixel => [
  data[pixelIndex],
  data[pixelIndex + 1],
  data[pixelIndex + 2],
  data[pixelIndex + 3],
];

export const readNormalizedPixel = (
  data: ImageRawDataArray,
  pixelIndex: number,
): RgbaNormalizedPixel => [
  data[pixelIndex] / 255,
  data[pixelIndex + 1] / 255,
  data[pixelIndex + 2] / 255,
  data[pixelIndex + 3] / 255,
];
