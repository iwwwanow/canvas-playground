import { describe, expect, test } from "bun:test";
import { Layer } from "./layer";
import { Color } from "./color";
import { Channel } from "../types";

const makeLayer = (bytes: number[], width: number, height = 1) =>
  new Layer(new Uint8ClampedArray(bytes), { width, height }, {});

describe("Layer", () => {
  test("fill sets every pixel to the given color", () => {
    const layer = makeLayer([0, 0, 0, 0, 0, 0, 0, 0], 2);
    layer.fill(Color.fromRgb([10, 20, 30]));
    expect([...layer.imageData]).toEqual([10, 20, 30, 255, 10, 20, 30, 255]);
  });

  test("setBlendMode/setOpacity record options without touching imageData", () => {
    const layer = makeLayer([1, 2, 3, 4], 1);
    layer.setBlendMode("add");
    layer.setOpacity(0.5);
    expect(layer.options).toEqual({ blendMode: "add", opacity: 0.5 });
    expect([...layer.imageData]).toEqual([1, 2, 3, 4]);
  });

  test("setTransform applies eagerly to imageData", () => {
    const layer = makeLayer([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0], 3);
    layer.setTransform({ name: "translate", params: { tx: 1, ty: 0 } });
    expect([...layer.imageData.slice(4, 8)]).toEqual([255, 0, 0, 255]);
    expect(layer.options.transform).toEqual({ name: "translate", params: { tx: 1, ty: 0 } });
  });

  test("mask delegates to the matching HSV masker", () => {
    const layer = makeLayer([255, 0, 0, 255], 1); // hue 0, saturation 100, value 100
    layer.mask({ name: "hue", value: 0 });
    expect(layer.imageData[3]).toBe(255);
  });

  test("isolateChannel moves the channel value into alpha", () => {
    const layer = makeLayer([10, 20, 30, 40], 1);
    layer.isolateChannel(Channel.Blue);
    expect([...layer.imageData]).toEqual([0, 0, 255, 30]);
  });

  test("applyEffect(noize) mutates imageData in place", () => {
    const layer = makeLayer([255, 0, 0, 255], 1);
    layer.applyEffect({ name: "noize", options: { deviationCoefficient: 0, preserveAlpha: true } });
    // deviation 0 => no hue shift, output should equal input
    expect([...layer.imageData]).toEqual([255, 0, 0, 255]);
  });
});
