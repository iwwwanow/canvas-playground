import { hexToRgb } from "../utils/color-space";
import type { HexString, RgbPixel, RgbaNormalizedPixel, RgbaPixel } from "../types";

const toHexByte = (value: number): string => value.toString(16).padStart(2, "0");

export class Color {
  constructor(private readonly rgba: RgbaPixel) {}

  static fromHex(hex: HexString): Color {
    const [r, g, b] = hexToRgb(hex);
    return new Color([r, g, b, 255]);
  }

  static fromRgb(rgb: RgbPixel): Color {
    return new Color([...rgb, 255]);
  }

  static fromUintArray(data: Uint8ClampedArray, pixelIndex: number): Color {
    return new Color([data[pixelIndex], data[pixelIndex + 1], data[pixelIndex + 2], data[pixelIndex + 3]]);
  }

  get normalized(): RgbaNormalizedPixel {
    return this.rgba.map((c) => c / 255) as RgbaNormalizedPixel;
  }

  get hex(): HexString {
    const [r, g, b] = this.rgba;
    return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  }
}
