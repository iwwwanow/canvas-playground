import { describe, expect, test } from "bun:test";
import { Matrix } from "./matrix";

describe("Matrix", () => {
  test("getItem/setItem address row-major storage", () => {
    const m = new Matrix(3, 2, [1, 2, 3, 4, 5, 6]);
    expect(m.getItem(0, 0)).toBe(1);
    expect(m.getItem(2, 1)).toBe(6);

    m.setItem(1, 0, 99);
    expect(m.getItem(1, 0)).toBe(99);
  });

  test("setItem ignores out-of-bounds writes", () => {
    const m = new Matrix(2, 2, [0, 0, 0, 0]);
    m.setItem(-1, 0, 1);
    m.setItem(0, 2, 1);
    expect(m.getItem(0, 0)).toBe(0);
  });

  test("throws on inconsistent length", () => {
    expect(() => new Matrix(2, 2, [1, 2, 3])).toThrow();
  });

  test("multiply: row-vector times 3x3 identity is a no-op", () => {
    const point = new Matrix(3, 1, [5, 7, 1]);
    const identity = new Matrix(3, 3, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const result = Matrix.multiply(point, identity);
    expect(result.getItem(0, 0)).toBe(5);
    expect(result.getItem(1, 0)).toBe(7);
    expect(result.getItem(2, 0)).toBe(1);
  });

  test("multiply: row-vector times translate matrix", () => {
    const point = new Matrix(3, 1, [5, 7, 1]);
    // point*M convention (see domain/services/transforms.ts): translate stores [tx,ty] in row 2.
    const translate = new Matrix(3, 3, [1, 0, 0, 0, 1, 0, 3, -2, 1]);
    const result = Matrix.multiply(point, translate);
    expect(result.getItem(0, 0)).toBe(8);
    expect(result.getItem(1, 0)).toBe(5);
  });

  test("multiply throws on incompatible dimensions", () => {
    const a = new Matrix(2, 2, [1, 2, 3, 4]);
    const b = new Matrix(3, 3, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(() => Matrix.multiply(a, b)).toThrow();
  });
});
