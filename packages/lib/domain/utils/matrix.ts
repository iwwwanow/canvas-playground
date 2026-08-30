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

  static inverse(m: Matrix): Matrix {
    if (m.width !== 3 || m.height !== 3) throw new Error("inverse only implemented for 3×3");
    const g = (c: number, r: number) => m.getItem(c, r);
    const a = g(0,0), b = g(1,0), c = g(2,0);
    const d = g(0,1), e = g(1,1), f = g(2,1);
    const p = g(0,2), q = g(1,2), k = g(2,2);
    const C00 = e*k - f*q, C01 = -(d*k - f*p), C02 = d*q - e*p;
    const C10 = -(b*k - c*q), C11 = a*k - c*p, C12 = -(a*q - b*p);
    const C20 = b*f - c*e, C21 = -(a*f - c*d), C22 = a*e - b*d;
    const det = a*C00 + b*C01 + c*C02;
    if (Math.abs(det) < 1e-10) throw new Error("Matrix is singular");
    return new Matrix(3, 3, [
      C00/det, C10/det, C20/det,
      C01/det, C11/det, C21/det,
      C02/det, C12/det, C22/det,
    ]);
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
