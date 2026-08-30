import { readNormalizedPixel } from "../utils/pixel-io";
import { alphaComposing } from "../utils/alpha-composing";
import { rgbToLab, labToRgb } from "../utils/color-space";
import type { ImageRawDataArray } from "../types";

export const alphaCompose = (
  bgData: ImageRawDataArray,
  fgData: ImageRawDataArray,
): ImageRawDataArray => {
  const output = new Uint8ClampedArray(bgData.length);

  for (let i = 0; i < bgData.length; i += 4) {
    const [bgR, bgG, bgB, bgA] = readNormalizedPixel(bgData, i);
    const [fgR, fgG, fgB, fgA] = readNormalizedPixel(fgData, i);

    const resultAlpha = fgA + bgA * (1 - fgA);

    output[i] = alphaComposing(fgR, fgA, bgR, bgA, resultAlpha) * 255;
    output[i + 1] = alphaComposing(fgG, fgA, bgG, bgA, resultAlpha) * 255;
    output[i + 2] = alphaComposing(fgB, fgA, bgB, bgA, resultAlpha) * 255;
    output[i + 3] = resultAlpha * 255;
  }

  return output;
};

// LCh Hue: берёт Hue из FG, Lightness и Chroma из BG. FG opacity управляет силой эффекта.
export const lchHueCompose = (
  bgData: ImageRawDataArray,
  fgData: ImageRawDataArray,
): ImageRawDataArray => {
  const output = new Uint8ClampedArray(bgData.length);

  for (let i = 0; i < bgData.length; i += 4) {
    const [bgR, bgG, bgB, bgA] = readNormalizedPixel(bgData, i);
    const [fgR, fgG, fgB, fgA] = readNormalizedPixel(fgData, i);

    const bgLab = rgbToLab([bgR, bgG, bgB]);
    const fgLab = rgbToLab([fgR, fgG, fgB]);

    const bgChroma = Math.sqrt(bgLab[1] ** 2 + bgLab[2] ** 2);
    const fgHue = Math.atan2(fgLab[2], fgLab[1]);

    const blended = labToRgb([bgLab[0], bgChroma * Math.cos(fgHue), bgChroma * Math.sin(fgHue)]);

    output[i]     = (fgA * blended[0] + (1 - fgA) * bgR) * 255;
    output[i + 1] = (fgA * blended[1] + (1 - fgA) * bgG) * 255;
    output[i + 2] = (fgA * blended[2] + (1 - fgA) * bgB) * 255;
    output[i + 3] = bgA * 255;
  }

  return output;
};

export const addCompose = (
  bgData: ImageRawDataArray,
  fgData: ImageRawDataArray,
): ImageRawDataArray => {
  const output = new Uint8ClampedArray(bgData.length);

  for (let i = 0; i < bgData.length; i += 4) {
    const [bgR, bgG, bgB] = readNormalizedPixel(bgData, i);
    const [fgR, fgG, fgB, fgA] = readNormalizedPixel(fgData, i);

    output[i] = Math.min(1, bgR + fgR * fgA) * 255;
    output[i + 1] = Math.min(1, bgG + fgG * fgA) * 255;
    output[i + 2] = Math.min(1, bgB + fgB * fgA) * 255;
    output[i + 3] = 255;
  }

  return output;
};
