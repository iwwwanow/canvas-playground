import type { CompositionConstructor } from "./composition.interfaces";
import { translateTransform } from "../transformations";
import { alphaCompose } from "../composers";
import { addCompose } from "../composers";
import { Channel } from "./composition.interfaces";
import { cutChannel } from "../cutters";
import { Layer } from "./layer.class";
import { BlendMod } from "./composition.interfaces";
import { cutHue } from "../cutters";
import type { CompositionOpitons } from "./composition.interfaces";
import { TransformType } from "./layer.interfaces";

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 100;

export class Composition {
  canvas: HTMLCanvasElement | null;
  canvasId: string;
  ctx: CanvasRenderingContext2D | null;
  img: HTMLImageElement | null;
  imgQuerySelector: string;
  layers: Array<Layer>;
  imageData: ImageData | null;
  imageDataLength: number;
  width: CompositionOpitons["width"];
  height: CompositionOpitons["height"];

  constructor({ canvasId, imgQuerySelector, options }: CompositionConstructor) {
    this.canvas = null;
    this.ctx = null;
    this.img = null;
    this.imgQuerySelector = imgQuerySelector;
    this.imageData = null;
    this.imageDataLength = 0;

    this.canvasId = canvasId;

    this.layers = [];

    this.width = options?.width || DEFAULT_WIDTH;
    this.height = options?.height || DEFAULT_HEIGHT;
  }

  init() {
    this.canvas = document.getElementById(
      this.canvasId,
    ) as HTMLCanvasElement | null;

    if (!this.canvas) throw new Error("canvas not defined");
    this.ctx = this.canvas.getContext("2d");

    this.img = document.querySelector(this.imgQuerySelector);

    if (!this.ctx) throw new Error("ctx not defined");
    if (!this.img) throw new Error("img not defined");
    this.ctx.drawImage(this.img, 0, 0, this.width, this.height);

    this.img.style.display = "none";

    this.imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    this.imageDataLength = this.imageData.data.length;
  }

  addLayer(layer: Layer) {
    this.layers.push(layer);
  }

  // TODO: write it
  addColorLayer() {
    const blackLayer = new Layer(this.getBlackArrayData());
    this.addLayer(blackLayer);
  }

  private getBlackArrayData(
    // TODO: is it needed?
    arrayLength: number = this.imageDataLength,
  ): Uint8ClampedArray {
    // INFO: fill alpha layer
    let layerData = new Uint8ClampedArray(arrayLength).map((_, index) => {
      if (index % 4 == 3) {
        return 255;
      }
      return 0;
    });
    return layerData;
  }

  cutChannel(data: Uint8ClampedArray, channel: Channel): Uint8ClampedArray {
    return cutChannel(data, channel);
  }

  // TODO: naming
  cutHue(data: Uint8ClampedArray, neededHue: number): Uint8ClampedArray {
    return cutHue(data, neededHue);
  }

  // TODO: refactor
  getMergedLayer(layers: Array<Layer>): Layer {
    let resultLayer = new Layer(new Uint8ClampedArray(this.imageDataLength));

    resultLayer = layers.reduce((bgLayer, fgLayer) => {
      let bgLayerData = bgLayer.data;
      let fgLayerData = fgLayer.data;

      // TODO: refactor
      if (bgLayer.options?.opacity) {
        bgLayerData = bgLayerData.map((value, index) => {
          if (index % 4 === 3) return value * bgLayer.options?.opacity;
          return value;
        });
      }

      // TODO: refactor
      if (fgLayer.options?.opacity) {
        fgLayerData = fgLayerData.map((value, index) => {
          if (index % 4 === 3) return value * fgLayer.options?.opacity;
          return value;
        });
      }

      let resultLayerData = new Uint8ClampedArray(this.imageDataLength);

      switch (fgLayer.options?.blendMod) {
        case BlendMod.add:
          resultLayerData = addCompose(bgLayerData, fgLayerData);
          break;
        default:
          resultLayerData = alphaCompose(bgLayerData, fgLayerData);
          break;
      }

      return new Layer(resultLayerData);
    });

    return resultLayer;
  }

  clearLayers() {
    this.layers = [];
  }

  private getTransformedLayers(layers: Array<Layer>): Array<Layer> {
    return layers.map((layer) => {
      if (!layer.options?.transform) return layer;

      switch (layer.options?.transform.type) {
        case TransformType.Translate:
          const { x, y } = layer.options.transform;

          const transformedData = translateTransform(
            layer.data,
            this.width,
            this.height,
            x,
            y,
          );
          layer.setData(transformedData);

          return layer;
        default:
          return layer;
      }
    });
  }

  render() {
    if (!this.ctx) throw new Error("ctx is not defined");

    const transformedLayers = this.getTransformedLayers(this.layers);

    const mergedLayer = this.getMergedLayer(transformedLayers);

    const mergedLayersImageData = new ImageData(
      // TODO: fix?
      mergedLayer.data,
      this.width,
      this.height,
    );

    this.ctx.putImageData(mergedLayersImageData, 0, 0);
  }
}
