const IMAGE_WIDTH = 300;
const IMAGE_HEIGHT = 400;

export class Composition {
  constructor(canvasId, imageSrc) {
    this.canvasId = canvasId;
    this.imageSrc = imageSrc;
  }

  init() {
    this.#initCanvas();
    this.#initImage();
  }

  #initCanvas() {
    this.canvas = document.getElementById(this.canvasId);
    if (this.canvas.getContext) {
      this.ctx = this.canvas.getContext("2d");
    }
  }

  #initImage() {
    // this.img = new Image();
    this.img = document.querySelector("#source");
    this.img.style.display = "none";
    this.img.onload = this.#onImageLoadHander();
  }

  #onImageLoadHander() {
    this.ctx.drawImage(this.img, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );

    const redLayerArrayData = this.#getRedLayerData(imageData.data);
    const greenLayerArrayData = this.#getGreenLayerData(imageData.data);
    const blueLayerArrayData = this.#getBlueLayerData(imageData.data);

    const mergedLayersArrayData = this.#mergeLayers({
      redLayerData: redLayerArrayData,
      greenLayerData: greenLayerArrayData,
      blueLayerData: blueLayerArrayData,
    });

    const mergedLayersImageData = new ImageData(
      mergedLayersArrayData,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
    );

    this.ctx.putImageData(mergedLayersImageData, 0, 0);
  }

  #getRedLayerData(data) {
    const output = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      output[i + 3] = data[i];

      output[i] = 255;
      output[i + 1] = 0;
      output[i + 2] = 0;
    }
    return output;
  }

  #getGreenLayerData(data) {
    const output = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      output[i + 3] = data[i + 1];

      output[i] = 0;
      output[i + 1] = 255;
      output[i + 2] = 0;
    }
    return output;
  }

  #getBlueLayerData(data) {
    let output = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      output[i + 3] = data[i + 2];

      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = 255;
    }
    return output;
  }

  #mergeLayers({ redLayerData, greenLayerData, blueLayerData }) {
    // INFO: fill alpha layer
    let backgroundLayerData = new Uint8ClampedArray(redLayerData.length).map(
      (_, index) => {
        if (index % 4 == 3) {
          return 255;
        }
        return 0;
      },
    );

    const layersData = [
      backgroundLayerData,
      redLayerData,
      greenLayerData,
      blueLayerData,
    ];
    let output2 = new Uint8ClampedArray(redLayerData.length);

    output2 = layersData.reduce((backgroundLayerData, forwardLayerData) => {
      let output = new Uint8ClampedArray(redLayerData.length);

      for (let i = 0; i < redLayerData.length; i += 4) {
        const redIndex = i;
        const greenIndex = i + 1;
        const blueIndex = i + 2;
        const alphaIndex = i + 3;

        const fgLayerNormalRed = forwardLayerData[redIndex] / 255;
        const fgLayerNormalGreen = forwardLayerData[greenIndex] / 255;
        const fgLayerNormalBlue = forwardLayerData[blueIndex] / 255;
        const fgLayerNormalAlpha = forwardLayerData[alphaIndex] / 255;

        const bgLayerNormalRed = backgroundLayerData[redIndex] / 255;
        const bgLayerNormalGreen = backgroundLayerData[greenIndex] / 255;
        const bgLayerNormalBlue = backgroundLayerData[blueIndex] / 255;
        const bgLayerNormalAlpha = backgroundLayerData[alphaIndex] / 255;

        const resultAlpha =
          fgLayerNormalAlpha + bgLayerNormalAlpha * (1 - fgLayerNormalAlpha);

        const getResultNormalColor = (
          fgColor,
          fgAlpha,
          bgColor,
          bgAlpha,
          resultAlpha,
        ) => {
          const result =
            (fgColor * fgAlpha + bgColor * bgAlpha * (1 - fgAlpha)) /
            resultAlpha;
          return result;
        };

        const redResult = getResultNormalColor(
          fgLayerNormalRed,
          fgLayerNormalAlpha,
          bgLayerNormalRed,
          bgLayerNormalAlpha,
          resultAlpha,
        );

        const greenResult = getResultNormalColor(
          fgLayerNormalGreen,
          fgLayerNormalAlpha,
          bgLayerNormalGreen,
          bgLayerNormalAlpha,
          resultAlpha,
        );

        const blueResult = getResultNormalColor(
          fgLayerNormalBlue,
          fgLayerNormalAlpha,
          bgLayerNormalBlue,
          bgLayerNormalAlpha,
          resultAlpha,
        );

        output[redIndex] = redResult * 255;
        output[greenIndex] = greenResult * 255;
        output[blueIndex] = blueResult * 255;
        output[alphaIndex] = resultAlpha * 255;
      }

      return output;
    });

    return output2;
  }
}
