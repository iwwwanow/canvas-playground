import { describe, expect, test } from "bun:test";
import { mergeLayerData } from "./reducer";

describe("mergeLayerData", () => {
  const bg = new Uint8ClampedArray([255, 255, 255, 255]);
  const fg = new Uint8ClampedArray([0, 0, 255, 255]);

  test("normal blend mode delegates to alphaCompose", () => {
    expect([...mergeLayerData(4, bg, fg, "normal")]).toEqual([0, 0, 255, 255]);
  });

  test("add blend mode delegates to addCompose", () => {
    const dimBg = new Uint8ClampedArray([50, 0, 0, 255]);
    const dimFg = new Uint8ClampedArray([100, 0, 0, 255]);
    expect([...mergeLayerData(4, dimBg, dimFg, "add")]).toEqual([150, 0, 0, 255]);
  });

  test("throws when a buffer's length doesn't match dataLength", () => {
    expect(() => mergeLayerData(8, bg, fg, "normal")).toThrow();
  });
});
