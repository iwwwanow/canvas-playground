import type { CompositionConstructor } from "./composition.interfaces";
import { Pixel } from "./pixel.class";
import { getResultAlpha } from "../colors";
import { getResultColors } from "../colors";
import { getChannelIndex } from "../utils";
import { alphaCompose } from "../composers";
import { Channel } from "./composition.interfaces";

const IMAGE_WIDTH = 300;
const IMAGE_HEIGHT = 400;

export class Composition {
  canvas: HTMLCanvasElement | null;
  canvasId: string;
  imageSrc: string;
  ctx: CanvasRenderingContext2D | null;
  img: HTMLImageElement | null;

  constructor({ canvasId, imageSrc }: CompositionConstructor) {
    this.canvas = null;
    this.ctx = null;
    this.img = null;

    this.canvasId = canvasId;
    this.imageSrc = imageSrc;
  }

  init() {
    this.initCanvas();
    this.initImage();
  }

  private initCanvas() {
    this.canvas = document.getElementById(
      this.canvasId,
    ) as HTMLCanvasElement | null;

    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
    }
  }

  private initImage() {
    this.img = document.querySelector("#source");
    if (this.img) {
      this.img.style.display = "none";
      this.img.onload = this.onImageLoadHander();
    }
  }

  private onImageLoadHander(): GlobalEventHandlers["onload"] {
    if (!this.ctx) throw new Error("ctx not defined");
    if (!this.canvas) throw new Error("canvas not defined");
    if (!this.img) throw new Error("img not defined");

    this.ctx.drawImage(this.img, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );

    // const redLayerArrayData = this.getRedLayerData(imageData.data);
    const redLayerArrayData = this.cutChannel(imageData.data, Channel.Red);

    const greenLayerArrayData = this.getGreenLayerData(imageData.data);
    const blueLayerArrayData = this.getBlueLayerData(imageData.data);
    const blackLayerArrayData = this.getBlackLayerData(
      redLayerArrayData.length,
    );

    const mergedLayersArrayData = this.mergeLayers([
      blackLayerArrayData,
      redLayerArrayData,
      greenLayerArrayData,
      blueLayerArrayData,
    ]);

    const mergedLayersImageData = new ImageData(
      // TODO: fix?
      mergedLayersArrayData,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
    );

    this.ctx.putImageData(mergedLayersImageData, 0, 0);

    return null;
  }

  private getBlackLayerData(arrayLength: number): Uint8ClampedArray {
    // INFO: fill alpha layer
    let layerData = new Uint8ClampedArray(arrayLength).map((_, index) => {
      if (index % 4 == 3) {
        return 255;
      }
      return 0;
    });
    return layerData;
  }

  // TODO: refactor; use Pixel
  // TODO: write test for it
  private cutChannel(data: Uint8ClampedArray, channel: Channel) {
    const neededColorIndex = getChannelIndex(channel);
    const isNeededColor = (
      neededColorIndex: number,
      colorIndex: number,
    ): boolean => {
      return neededColorIndex === colorIndex;
    };

    const output = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const redIndex = i;
      const greenIndex = i + 1;
      const blueIndex = i + 2;
      const alphaIndex = i + 3;
      const neededColorValue = data[i + neededColorIndex];

      output[alphaIndex] = neededColorValue;

      output[redIndex] = Number(isNeededColor(neededColorIndex, 0)) * 255;
      output[greenIndex] = Number(isNeededColor(neededColorIndex, 1)) * 255;
      output[blueIndex] = Number(isNeededColor(neededColorIndex, 2)) * 255;
    }
    console.log(output);
    return output;
  }

  private getRedLayerData(data: Uint8ClampedArray): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      output[i + 3] = data[i];

      output[i] = 255;
      output[i + 1] = 0;
      output[i + 2] = 0;
    }
    return output;
  }

  private getGreenLayerData(data: Uint8ClampedArray): Uint8ClampedArray {
    const output = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      output[i + 3] = data[i + 1];

      output[i] = 0;
      output[i + 1] = 255;
      output[i + 2] = 0;
    }
    return output;
  }

  private getBlueLayerData(data: Uint8ClampedArray): Uint8ClampedArray {
    let output = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      output[i + 3] = data[i + 2];

      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = 255;
    }
    return output;
  }

  private mergeLayers(layersData: Array<Uint8ClampedArray>): Uint8ClampedArray {
    const resultLayerDataLength = layersData[0].length;
    let output2 = new Uint8ClampedArray(resultLayerDataLength);
    output2 = layersData.reduce(alphaCompose);
    return output2;
  }
}
