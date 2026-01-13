import type { RgbaArray } from "../interfaces";

// TODO: tests
export class Matrix {
  width: number;
  height: number;
  rawData: Array<[number, number, number, number]>;
  data: Array<number>;

  constructor(width: number, height: number, data: Array<number>) {
    if (width * height !== data.length) {
      // TODO: math error
      throw new Error("incorrect matrix length");
    }

    this.width = width;
    this.height = height;
    this.data = data;

    // TODO: rm it; it math class
    this.rawData = Array.from({ length: this.width * this.height }, (_, i) => [
      255, 255, 255, 255,
    ]);
  }

  setPixelValue(x: number, y: number, value: RgbaArray) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return;
    }

    const pixelIndex = y * this.width + x;
    this.rawData[pixelIndex] = value;
  }

  getItem(column: number, row: number): number {
    const index = this.width * row + column;
    return this.data[index];
  }

  setItem(column: number, row: number, value: number): void {
    const index = this.width * row + column;
    this.data[index] = value;
  }

  getUintData(): Uint8ClampedArray {
    return new Uint8ClampedArray(this.rawData.flat(1));
  }

  // TODO: use math canonnical namings (i, j)
  static multiply(matrix1: Matrix, matrix2: Matrix): Matrix {
    if (matrix1.width !== matrix2.height) {
      throw new Error("matrix unconsistent");
    }

    const resultMatrixWidth = matrix2.width;
    const resultMatrixHeight = matrix1.height;

    const resultMatrixLength = resultMatrixHeight * resultMatrixWidth;
    const resultMatrixData = new Array(resultMatrixLength);

    const resultMatrix = new Matrix(
      resultMatrixWidth,
      resultMatrixHeight,
      resultMatrixData,
    );

    for (let column = 0; column < resultMatrixWidth; column++) {
      for (let row = 0; row < resultMatrixHeight; row++) {
        let sum = 0;
        for (let k = 0; k < matrix1.width; k++) {
          sum += matrix1.getItem(k, row) * matrix2.getItem(column, k);
        }
        resultMatrix.setItem(column, row, sum);
      }
    }

    return resultMatrix;
  }
}
