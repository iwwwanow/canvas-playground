import { rgbToHsl } from "../utils";
import { BlendMod } from "./composition.interfaces";
import type { LayerOptions, TransformType } from "./layer.interfaces";
import { Pixel } from "./pixel.class";
import { hslToRgb } from "../utils";

export class Layer {
  options?: LayerOptions = {};
  data: Uint8ClampedArray;

  constructor(data: Uint8ClampedArray, options?: LayerOptions) {
    this.data = data;
    this.options = options;
  }

  setBlendMode(blendMod: BlendMod) {
    if (!this.options) this.options = {};
    this.options.blendMod = blendMod;
  }

  setData(data: Uint8ClampedArray) {
    this.data = data;
  }

  setOpacity(opacity: number) {
    if (!this.options) this.options = {};
    this.options.opacity = opacity;
  }

  setTransform(type: TransformType, x: number, y: number) {
    if (!this.options) this.options = {};
    if (!this.options.transform) this.options.transform = { type, x, y };
  }

  // TODO: add effet: `effectName`
  addHueNoize(
    deviationCoefficient: number = 0.1,
    preserveAlpha: boolean = true,
  ) {
    if (deviationCoefficient < 0 || deviationCoefficient > 1) {
      throw new Error("deviationCoefficient должен быть в диапазоне 0-1");
    }

    const output = new Uint8ClampedArray(this.data.length);

    for (let i = 0; i < this.data.length; i += 4) {
      const [r, g, b, a] = Pixel.getDataFromLayer(i, this.data).map(
        (i) => i / 255,
      );

      let [h, s, l] = rgbToHsl([r, g, b]);

      const noise = (Math.random() * 2 - 1) * deviationCoefficient;
      h = (h + noise) % 1.0;
      if (h < 0) h += 1.0;

      const [newR, newG, newB] = hslToRgb([h, s, l]);

      output[i] = Math.round(newR * 255);
      output[i + 1] = Math.round(newG * 255);
      output[i + 2] = Math.round(newB * 255);
      output[i + 3] = preserveAlpha ? Math.round(a * 255) : this.data[i + 3];
    }

    this.data = output;
  }
}
