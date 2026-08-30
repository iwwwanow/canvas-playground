import { describe, expect, test } from "bun:test";
import { alphaComposing } from "./alpha-composing";

describe("alphaComposing", () => {
  test("opaque foreground fully occludes background", () => {
    const result = alphaComposing(1, 1, 0, 1, 1);
    expect(result).toBe(1);
  });

  test("fully transparent foreground passes background through", () => {
    const result = alphaComposing(1, 0, 0.5, 1, 1);
    expect(result).toBeCloseTo(0.5);
  });

  test("blends half-transparent foreground over opaque background", () => {
    const result = alphaComposing(1, 0.5, 0, 1, 1);
    expect(result).toBeCloseTo(0.5);
  });
});
