import type { LayerOptions } from "./layer.interfaces";
export class Layer {
  options?: LayerOptions;
  data: Uint8ClampedArray;

  constructor(data?: Uint8ClampedArray, options?: LayerOptions) {
    this.data = data || new Uint8ClampedArray();
    this.options = options;
  }
}
