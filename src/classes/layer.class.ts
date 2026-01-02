import { BlendMod } from "./composition.interfaces";
import type { LayerOptions } from "./layer.interfaces";

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
}
