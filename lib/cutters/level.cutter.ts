import { rgbToHsv } from "../utils";
import { Pixel } from "../classes";

export const cutLevel = (
  data: Uint8ClampedArray,
  neededLevel: number,
): Uint8ClampedArray => {
  const normalNeedeHue = neededLevel / 360;

  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const [pixelRed, pixelGreen, pixelBlue] = Pixel.getDataFromUintArray(
      i,
      data,
    );

    const [pixelHue] = rgbToHsv([pixelRed, pixelGreen, pixelBlue]);

    const redIndex = i;
    const greenIndex = i + 1;
    const blueIndex = i + 2;
    const alphaIndex = i + 3;

    const normalPixelHue = pixelHue / 360;

    let hueDifference = Math.abs(normalNeedeHue - normalPixelHue);
    if (hueDifference > 0.5) {
      hueDifference = 1 - hueDifference;
    }

    const hueTolerance = 0.02;

    let alpha = 0;
    if (hueDifference <= hueTolerance) {
      const normalizedDiff = hueDifference / hueTolerance;
      alpha = 1 - normalizedDiff * normalizedDiff;
    }

    // if (pixelHue === neededHue) {
    output[redIndex] = pixelRed;
    output[greenIndex] = pixelGreen;
    output[blueIndex] = pixelBlue;
    output[alphaIndex] = Math.round(alpha * 255);
  }

  return output;
};
