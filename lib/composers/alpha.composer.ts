import { Pixel } from "../classes";
import { getResultAlpha } from "../colors";
import { getResultColors } from "../colors";

// TODO: слишком глубокая вложенность фукнций. поднять все на этот уровень. оставить только её и math
export const alphaCompose = (
  bgLayerData: Uint8ClampedArray,
  fgLayerData: Uint8ClampedArray,
) => {
  let output = new Array(bgLayerData.length);

  for (let pixelIndex = 0; pixelIndex < bgLayerData.length; pixelIndex += 4) {
    const bgPixelData = Pixel.getDataFromUintArray(pixelIndex, bgLayerData);
    const fgPixelData = Pixel.getDataFromUintArray(pixelIndex, fgLayerData);

    const bgPixel = new Pixel(bgPixelData);
    const fgPixel = new Pixel(fgPixelData);

    const resultNormalAlpha = getResultAlpha(fgPixel.nc.a, bgPixel.nc.a);

    const resultNormalColors = getResultColors(
      bgPixel,
      fgPixel,
      resultNormalAlpha,
    );

    const resultNormalPixel = [...resultNormalColors, resultNormalAlpha];
    const resultPixel = resultNormalPixel.map((c) => c * 255);

    output.splice(pixelIndex, 4, ...resultPixel);
  }

  return new Uint8ClampedArray(output);
};
