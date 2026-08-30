export class Matrix {
  constructor(
    private width: number,
    private height: number,
    private data: Array<number>,
  ) {
    if (width * height !== data.length) {
      throw new Error("incorrect matrix length");
    }
  }

  getItem(column: number, row: number): number {
    return this.data[this.width * row + column];
  }

  setItem(column: number, row: number, value: number): void {
    if (column < 0 || column >= this.width || row < 0 || row >= this.height) {
      return;
    }
    this.data[this.width * row + column] = value;
  }

  static multiply(a: Matrix, b: Matrix): Matrix {
    if (a.width !== b.height) {
      throw new Error("matrix unconsistent");
    }

    const resultWidth = b.width;
    const resultHeight = a.height;
    const result = new Matrix(resultWidth, resultHeight, new Array(resultWidth * resultHeight).fill(0));

    for (let column = 0; column < resultWidth; column++) {
      for (let row = 0; row < resultHeight; row++) {
        let sum = 0;
        for (let k = 0; k < a.width; k++) {
          sum += a.getItem(k, row) * b.getItem(column, k);
        }
        result.setItem(column, row, sum);
      }
    }

    return result;
  }
}
