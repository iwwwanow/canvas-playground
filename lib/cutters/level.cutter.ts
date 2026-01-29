import { rgbToHsv } from "../utils";
import { Pixel } from "../classes";

// TODO: rename it to cut value?
export const cutLevel = (
  data: Uint8ClampedArray,
  neededLevel: number,
): Uint8ClampedArray => {
  const normalNeedeLevel = neededLevel / 360;

  const output = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const [pixelRed, pixelGreen, pixelBlue] = Pixel.getDataFromUintArray(
      i,
      data,
    );

    const [_pixelHue, _pixelSaturation, pixelValue] = rgbToHsv([
      pixelRed,
      pixelGreen,
      pixelBlue,
    ]);

    const redIndex = i;
    const greenIndex = i + 1;
    const blueIndex = i + 2;
    const alphaIndex = i + 3;

    const normalPixelValue = pixelValue / 100;

    let valueDifference = Math.abs(normalNeedeLevel - normalPixelValue);
    if (valueDifference > 0.5) {
      valueDifference = 1 - valueDifference;
    }

    // TODO: pass it from params
    // const valueTolerance = 0.02;
    const valueTolerance = 0.1;

    let alpha = 0;
    if (valueDifference <= valueTolerance) {
      const normalizedDiff = valueDifference / valueTolerance;
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
