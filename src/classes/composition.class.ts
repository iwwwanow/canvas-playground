import type { CompositionConstructor } from "./composition.interfaces";
import { alphaCompose } from "../composers";
import { Channel } from "./composition.interfaces";
import { cutChannel } from "../cutters";
import { Layer } from "./layer.class";

const IMAGE_WIDTH = 300;
const IMAGE_HEIGHT = 400;

export class Composition {
  canvas: HTMLCanvasElement | null;
  canvasId: string;
  ctx: CanvasRenderingContext2D | null;
  img: HTMLImageElement | null;
  imgQuerySelector: string;
  layers: Array<Layer>;
  imageData: ImageData | null;
  imageDataLength: number;

  constructor({ canvasId, imgQuerySelector }: CompositionConstructor) {
    this.canvas = null;
    this.ctx = null;
    this.img = null;
    this.imgQuerySelector = imgQuerySelector;
    this.imageData = null;
    this.imageDataLength = 0;

    this.canvasId = canvasId;

    this.layers = [];
  }

  init() {
    this.canvas = document.getElementById(
      this.canvasId,
    ) as HTMLCanvasElement | null;

    if (!this.canvas) throw new Error("canvas not defined");
    this.ctx = this.canvas.getContext("2d");

    // TODO: constructor params
    this.img = document.querySelector(this.imgQuerySelector);

    if (!this.ctx) throw new Error("ctx not defined");
    if (!this.img) throw new Error("img not defined");
    this.ctx.drawImage(this.img, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

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

  cutChannel(data: Uint8ClampedArray, channel: Channel) {
    return cutChannel(data, channel);
  }

  mergeLayers(layers: Array<Layer>): Uint8ClampedArray {
    const layersData = layers.map(({ data }) => data);

    let output2 = new Uint8ClampedArray(this.imageDataLength);
    output2 = layersData.reduce((bgLayer, fgLayer) =>
      alphaCompose(bgLayer, fgLayer),
    );
    return output2;
  }

  render() {
    if (!this.ctx) throw new Error("ctx is not defined");

    const mergedLayersArrayData = this.mergeLayers(this.layers);

    const mergedLayersImageData = new ImageData(
      // TODO: fix?
      mergedLayersArrayData,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
    );

    this.ctx.putImageData(mergedLayersImageData, 0, 0);
  }
}
