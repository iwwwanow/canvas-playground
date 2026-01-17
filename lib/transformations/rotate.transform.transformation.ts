import { Matrix } from "../math";
import { Pixel } from "../classes";

const getAffineMatrix = (alpha: number): Matrix => {
  const radians = (Math.PI / 180) * alpha;

  return new Matrix(3, 3, [
    Math.cos(radians),
    -Math.sin(radians),
    0,
    Math.sin(radians),
    Math.cos(radians),
    0,
    0,
    0,
    1,
  ]);
};

export const rotateTransform = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alpha: number,
): Uint8ClampedArray => {
  const resultMatrix = new Matrix(
    width,
    height,
    new Array(width * height).fill([0, 0, 0, 0]),
  );
  const affineMatrix = getAffineMatrix(alpha);

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
