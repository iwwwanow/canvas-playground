import { Layer } from "./layer";
import type { Color } from "./color";
import { mergeLayerData } from "../services/reducer";
import type { ImageRawDataArray, LayerDimensions } from "../types";

// не хочу делать на этом уровне связку с canvas из браузерного слоя. лишнее
// (CanvasRenderer — отдельный слой инфраструктуры, потребляет render())
export class Composition {
  private readonly layers: Array<Layer>;
  private readonly dataLength: number;

  constructor(
    private readonly width: number,
    private readonly height: number,
    layers: Array<Layer> = [],
  ) {
    this.layers = layers;
    this.dataLength = width * height * 4;
  }

  private get dimensions(): LayerDimensions {
    return { width: this.width, height: this.height };
  }

  createLayerFromPixelData(pixelData: ImageRawDataArray): Layer {
    const layer = new Layer(pixelData, this.dimensions, {});
    this.layers.push(layer);
    return layer;
  }

  // полностью прозрачный слой (RGBA = 0), под размер композиции
  createBlankLayer(): Layer {
    return this.createLayerFromPixelData(new Uint8ClampedArray(this.dataLength));
  }

  // createBlankLayer() + layer.fill(color)
  createColorLayer(color: Color): Layer {
    const layer = this.createBlankLayer();
    layer.fill(color);
    return layer;
  }

  // deep copy: новый буфер, ни с чем памятью не делится
  duplicateLayer(layer: Layer): Layer {
    const duplicate = new Layer(new Uint8ClampedArray(layer.imageData), this.dimensions, {
      ...layer.options,
    });
    this.layers.push(duplicate);
    return duplicate;
  }

  private bakeOpacity(layer: Layer): ImageRawDataArray {
    const { opacity } = layer.options;
    if (opacity === undefined) return layer.imageData;

    const baked = new Uint8ClampedArray(layer.imageData);
    for (let i = 3; i < baked.length; i += 4) {
      baked[i] = baked[i] * opacity;
    }
    return baked;
  }

  render(): ImageRawDataArray {
    if (this.layers.length === 0) {
      return new Uint8ClampedArray(this.dataLength);
    }

    const [firstLayer, ...restLayers] = this.layers;
    return restLayers.reduce<ImageRawDataArray>(
      (bgData, fgLayer) =>
        mergeLayerData(this.dataLength, bgData, this.bakeOpacity(fgLayer), fgLayer.options.blendMode ?? "normal"),
      this.bakeOpacity(firstLayer),
    );
  }
}
