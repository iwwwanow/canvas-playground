import { Channel } from "../types";
import type { HexString, HslPixel, HsvPixel, RgbPixel, RgbaPixel } from "../types";

export const hexToRgb = (hex: HexString): RgbPixel => {
  const normalized = hex.replace(/^#/, "");

  let r: number;
  let g: number;
  let b: number;

  if (normalized.length === 3) {
    r = parseInt(normalized[0] + normalized[0], 16);
    g = parseInt(normalized[1] + normalized[1], 16);
    b = parseInt(normalized[2] + normalized[2], 16);
  } else if (normalized.length === 6) {
    r = parseInt(normalized.slice(0, 2), 16);
    g = parseInt(normalized.slice(2, 4), 16);
    b = parseInt(normalized.slice(4, 6), 16);
  } else {
    throw new Error("Invalid HEX color format");
  }

  return [r, g, b];
};

export const hexToRgba = (hex: HexString, alpha = 255): RgbaPixel => {
  const [r, g, b] = hexToRgb(hex);
  return [r, g, b, alpha];
};

// Ожидает нормализованный (0-1) RGB на входе — см. пометку про конвенцию в types.ts.
export const rgbToHsl = ([r, g, b]: RgbPixel): HslPixel => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
};

export const hslToRgb = ([h, s, l]: HslPixel): RgbPixel => {
  if (s === 0) {
    return [l, l, l];
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
};

// Принимает RGB как есть (0-255) — нормализует внутри. Возвращает H в градусах, S/V в процентах.
export const rgbToHsv = ([r, g, b]: RgbPixel): HsvPixel => {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;

  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const d = max - min;

  let hue = 0;
  const saturation = max === 0 ? 0 : d / max;
  const value = max;

  if (max !== min) {
    switch (max) {
      case nr:
        hue = (ng - nb) / d + (ng < nb ? 6 : 0);
        break;
      case ng:
        hue = (nb - nr) / d + 2;
        break;
      case nb:
        hue = (nr - ng) / d + 4;
        break;
    }
    hue /= 6;
  }

  return [hue * 360, saturation * 100, value * 100];
};

export const getChannelIndex = (channel: Channel): number => {
  switch (channel) {
    case Channel.Red:
      return 0;
    case Channel.Green:
      return 1;
    case Channel.Blue:
      return 2;
    case Channel.Alpha:
      return 3;
  }
};
