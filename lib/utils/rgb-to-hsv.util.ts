import type { RgbaArray } from "../interfaces";
import type { HsvArray } from "../interfaces";
import type { HueValue } from "../interfaces";
import type { SaturationValue } from "../interfaces";
import type { ValueValue } from "../interfaces";

export const rgbToHsv = ([r, g, b]: RgbaArray): HsvArray => {
  const normalizedR = r / 255;
  const normalizedG = g / 255;
  const normalizedBlue = b / 255;

  const max = Math.max(normalizedR, normalizedG, normalizedBlue);
  const min = Math.min(normalizedR, normalizedG, normalizedBlue);

  let h: HueValue;
  let s: SaturationValue;
  let v: ValueValue = max;

  const d = max - min;

  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0; // Achromatic
  } else {
    switch (max) {
      case normalizedR:
        h =
          (normalizedG - normalizedBlue) / d +
          (normalizedG < normalizedBlue ? 6 : 0);
        break;
      case normalizedG:
        h = (normalizedBlue - normalizedR) / d + 2;
        break;
      case normalizedBlue:
        h = (normalizedR - normalizedG) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, v * 100];
};
