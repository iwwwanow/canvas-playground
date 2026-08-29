import { describe, expect, test } from "bun:test";
import { getChannelIndex, hexToRgb, hexToRgba, hslToRgb, rgbToHsl, rgbToHsv } from "./color-space";
import { Channel } from "../types";

describe("hexToRgb", () => {
  test("expands 3-digit hex", () => {
    expect(hexToRgb("#0f0")).toEqual([0, 255, 0]);
  });

  test("parses 6-digit hex", () => {
    expect(hexToRgb("#336699")).toEqual([0x33, 0x66, 0x99]);
  });

  test("throws on invalid length", () => {
    expect(() => hexToRgb("#1234")).toThrow();
  });
});

describe("hexToRgba", () => {
  test("defaults alpha to 255", () => {
    expect(hexToRgba("#ffffff")).toEqual([255, 255, 255, 255]);
  });

  test("accepts explicit alpha", () => {
    expect(hexToRgba("#ffffff", 128)).toEqual([255, 255, 255, 128]);
  });
});

describe("rgbToHsl / hslToRgb (normalized 0-1)", () => {
  test("pure red", () => {
    const [h, s, l] = rgbToHsl([1, 0, 0]);
    expect(h).toBeCloseTo(0);
    expect(s).toBeCloseTo(1);
    expect(l).toBeCloseTo(0.5);
  });

  test("gray has zero saturation", () => {
    const [, s] = rgbToHsl([0.5, 0.5, 0.5]);
    expect(s).toBe(0);
  });

  test("round-trips through hslToRgb", () => {
    const original: [number, number, number] = [0.2, 0.6, 0.9];
    const hsl = rgbToHsl(original);
    const roundTripped = hslToRgb(hsl);
    roundTripped.forEach((value, i) => expect(value).toBeCloseTo(original[i], 5));
  });
});

describe("rgbToHsv (raw 0-255 in, degrees/percent out)", () => {
  test("pure green", () => {
    const [h, s, v] = rgbToHsv([0, 255, 0]);
    expect(h).toBeCloseTo(120);
    expect(s).toBeCloseTo(100);
    expect(v).toBeCloseTo(100);
  });

  test("black has zero saturation and value", () => {
    expect(rgbToHsv([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("getChannelIndex", () => {
  test("maps channels to byte offsets", () => {
    expect(getChannelIndex(Channel.Red)).toBe(0);
    expect(getChannelIndex(Channel.Green)).toBe(1);
    expect(getChannelIndex(Channel.Blue)).toBe(2);
    expect(getChannelIndex(Channel.Alpha)).toBe(3);
  });
});
