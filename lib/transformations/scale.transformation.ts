import { Matrix } from "../math";
import { Pixel } from "../classes";

const getAffineMatrix = (scaleX: number, scaleY: number): Matrix => {
  return new Matrix(3, 3, [scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1]);
};

// TODO: rework it to class
export const scaleTransform = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
): Uint8ClampedArray => {
  const resultMatrix = new Matrix(
    width,
    height,
    new Array(width * height).fill([0, 0, 0, 0]),
  );
  const affineMatrix = getAffineMatrix(scaleX, scaleY);

  for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
    const pixelValue = Pixel.getDataFromUintArray(pixelIndex, data);

    const pixelNum = pixelIndex / 4;
    const pixelX = pixelNum % width;
    const pixelY = Math.floor(pixelNum / width);

    const currentPixelMatrix = new Matrix(3, 1, [pixelX, pixelY, 1]);

    const multiplyedMatix = Matrix.multiply(currentPixelMatrix, affineMatrix);
    const [transletedX, transletedY] = multiplyedMatix.data;

    if (typeof transletedX === "number" && typeof transletedY === "number") {
      resultMatrix.setItem(
        Math.round(transletedX),
        Math.round(transletedY),
        pixelValue,
      );
    }
  }

  return new Uint8ClampedArray(resultMatrix.data.flat(1));
};
