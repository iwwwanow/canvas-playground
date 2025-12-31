import type { C } from "./classes/pixel.interfacess";
import type { NC } from "./classes/pixel.interfacess";

export class Pixel {
  c: C;
  nc: NC;

  constructor(pixelData: Array<number>) {
    const [r, g, b, a] = pixelData;

    this.c = {
      r,
      g,
      b,
      a,
    };

    this.nc = {
      r: r / 255,
      g: g / 255,
      b: b / 255,
      a: a / 255,
    };
  }

  static getDataFromLayer(
    pixelIndex: number,
    layerData: Uint8ClampedArray,
  ): Array<number> {
    return [
      layerData[pixelIndex],
      layerData[pixelIndex + 1],
      layerData[pixelIndex + 2],
      layerData[pixelIndex + 3],
    ];
  }
}
