import { Pixel } from "../classes";
import { Matrix } from "../math";

const getAffineMatrix = (tx: number, ty: number) => {
  return new Matrix(3, 3, [1, 0, 0, 0, 1, 0, tx, ty, 1]);
};

export const translateTransform = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tx: number,
  ty: number,
): Uint8ClampedArray => {
  const resultMatrix = new Matrix(
    width,
    height,
    new Array(width * height).fill([0, 0, 0, 0]),
  );
  const affineMatrix = getAffineMatrix(tx, ty);

  for (let pixelIndex = 0; pixelIndex < data.length; pixelIndex += 4) {
    const pixelValue = Pixel.getDataFromUintArray(pixelIndex, data);

    const pixelNum = pixelIndex / 4;
    const pixelX = pixelNum % width;
    const pixelY = Math.floor(pixelNum / width);

    const currentPixelMatrix = new Matrix(3, 1, [pixelX, pixelY, 1]);

    const multiplyedMatix = Matrix.multiply(currentPixelMatrix, affineMatrix);
    const [transletedX, transletedY] = multiplyedMatix.data;

    if (typeof transletedX === "number" && typeof transletedY === "number") {
      resultMatrix.setItem(transletedX, transletedY, pixelValue);
    }
  }

  return new Uint8ClampedArray(resultMatrix.data.flat(1));
};
