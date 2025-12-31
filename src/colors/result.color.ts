import type { Pixel } from "../classes";
import type { NC } from "../classes/pixel.interfaces";
import { alphaComposing } from "../math";

export const getResultColors = (
  bgPixel: Pixel,
  fgPixel: Pixel,
  resultAlpha: number,
) => {
  const getResultColor = (
    bgPixel: Pixel,
    fgPixel: Pixel,
    color: keyof NC,
    resultAlpha: number,
  ) => {
    return alphaComposing(
      fgPixel.nc[color],
      fgPixel.nc.a,
      bgPixel.nc[color],
      bgPixel.nc.a,
      resultAlpha,
    );
  };

  const redResult = getResultColor(bgPixel, fgPixel, "r", resultAlpha);
  const greenResult = getResultColor(bgPixel, fgPixel, "g", resultAlpha);
  const blueResult = getResultColor(bgPixel, fgPixel, "b", resultAlpha);

  return [redResult, greenResult, blueResult];
};
