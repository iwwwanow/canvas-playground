import { readNormalizedPixel } from "../utils/pixel-io";
import { rgbToHsl, hslToRgb } from "../utils/color-space";
import type { ImageRawDataArray } from "../types";

type HueNoiseOptions = { deviationCoefficient: number; preserveAlpha: boolean };

export const addHueNoise = (
  data: ImageRawDataArray,
  options: HueNoiseOptions,
): ImageRawDataArray => {
  const { deviationCoefficient, preserveAlpha } = options;

  if (deviationCoefficient < 0 || deviationCoefficient > 1) {
    throw new Error("deviationCoefficient должен быть в диапазоне 0-1");
  }

  const output = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = readNormalizedPixel(data, i);
    let [h, s, l] = rgbToHsl([r, g, b]);

    const noise = (Math.random() * 2 - 1) * deviationCoefficient;
    h = (h + noise) % 1.0;
    if (h < 0) h += 1.0;

    const [newR, newG, newB] = hslToRgb([h, s, l]);

    output[i] = newR * 255;
    output[i + 1] = newG * 255;
    output[i + 2] = newB * 255;
    output[i + 3] = preserveAlpha ? a * 255 : data[i + 3];
  }

  return output;
};

// Separable box blur — horizontal pass then vertical pass, O(n * radius).
export const boxBlur = (
  data: ImageRawDataArray,
  width: number,
  height: number,
  radius: number,
): ImageRawDataArray => {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return new Uint8ClampedArray(data);

  const temp = new Uint8ClampedArray(data.length);
  const output = new Uint8ClampedArray(data.length);

  // Horizontal pass: data → temp
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        const i = (y * width + nx) * 4;
        sumR += data[i];
        sumG += data[i + 1];
        sumB += data[i + 2];
        sumA += data[i + 3];
        count++;
      }
      const oi = (y * width + x) * 4;
      temp[oi] = sumR / count;
      temp[oi + 1] = sumG / count;
      temp[oi + 2] = sumB / count;
      temp[oi + 3] = sumA / count;
    }
  }

  // Vertical pass: temp → output
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        const i = (ny * width + x) * 4;
        sumR += temp[i];
        sumG += temp[i + 1];
        sumB += temp[i + 2];
        sumA += temp[i + 3];
        count++;
      }
      const oi = (y * width + x) * 4;
      output[oi] = sumR / count;
      output[oi + 1] = sumG / count;
      output[oi + 2] = sumB / count;
      output[oi + 3] = sumA / count;
    }
  }

  return output;
};
