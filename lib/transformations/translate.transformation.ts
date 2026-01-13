import { Pixel } from "../classes";
import { Matrix } from "../math";

const AFFINE_DATA = [];

export const translateTransform = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tx: number,
  ty: number,
): Uint8ClampedArray => {
  // const imageMatrix = new Matrix(width, height, data);
  const resultMatrix = new Matrix(width, height, new Array(width * height));

  // TODO: use it to multiply
  const affineData = new Uint8ClampedArray([1, 0, 0, 0, 1, 0, tx, ty, 1]);
  // const affineMatrix = new Matrix(3, 3, affineData);

  const imageSize = width * height;
  for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
    // TODO: use pixel class
    const pixelValue = Pixel.getDataFromUintArray(pixelIndex, data);

    const pixelNum = pixelIndex / 4;
    const pixelX = pixelNum % width;
    const pixelY = Math.floor(pixelNum / width);
    resultMatrix.setPixelValue(pixelX + tx, pixelY + ty, pixelValue);

    // TODO: matrix operation
  }

  return resultMatrix.getUintData();
  return data;
};
