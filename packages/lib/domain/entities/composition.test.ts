import { describe, expect, test } from "bun:test";
import { Composition } from "./composition";
import { Color } from "./color";

describe("Composition factory methods", () => {
  test("createBlankLayer yields a fully transparent layer sized to the composition", () => {
    const composition = new Composition(1, 2);
    const layer = composition.createBlankLayer();
    expect([...layer.imageData]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("createColorLayer fills every pixel with the given color", () => {
    const composition = new Composition(2, 1);
    const layer = composition.createColorLayer(Color.fromRgb([1, 2, 3]));
    expect([...layer.imageData]).toEqual([1, 2, 3, 255, 1, 2, 3, 255]);
  });

  test("duplicateLayer deep-copies the buffer and options, sharing no memory", () => {
    const composition = new Composition(1, 1);
    const original = composition.createColorLayer(Color.fromRgb([9, 9, 9]));
    original.setOpacity(0.5);

    const duplicate = composition.duplicateLayer(original);
    duplicate.fill(Color.fromRgb([0, 0, 0]));

    expect([...original.imageData]).toEqual([9, 9, 9, 255]);
    expect(duplicate.options).toEqual({ opacity: 0.5 });
  });
});

describe("Composition.render", () => {
  test("a single opaque layer renders as-is", () => {
    const composition = new Composition(1, 1);
    composition.createColorLayer(Color.fromRgb([5, 6, 7]));
    expect([...composition.render()]).toEqual([5, 6, 7, 255]);
  });

  test("layers merge back-to-front with normal blending", () => {
    const composition = new Composition(1, 1);
    composition.createColorLayer(Color.fromRgb([255, 255, 255]));
    composition.createColorLayer(Color.fromRgb([0, 0, 255]));
    expect([...composition.render()]).toEqual([0, 0, 255, 255]);
  });

  test("opacity is baked into alpha before merging", () => {
    const composition = new Composition(1, 1);
    composition.createColorLayer(Color.fromRgb([0, 0, 0]));
    const fg = composition.createColorLayer(Color.fromRgb([255, 255, 255]));
    fg.setOpacity(0.5);

    const [r] = composition.render();
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(155);
  });

  test("add blend mode sums layers additively", () => {
    const composition = new Composition(1, 1);
    composition.createColorLayer(Color.fromRgb([50, 0, 0]));
    const fg = composition.createColorLayer(Color.fromRgb([100, 0, 0]));
    fg.setBlendMode("add");
    expect([...composition.render()]).toEqual([150, 0, 0, 255]);
  });

  test("an empty composition renders a fully transparent buffer", () => {
    const composition = new Composition(1, 1);
    expect([...composition.render()]).toEqual([0, 0, 0, 0]);
  });
});
