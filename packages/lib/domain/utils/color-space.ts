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

// D65 reference white
const D65 = { x: 0.95047, y: 1.0, z: 1.08883 };
const LAB_DELTA = 6 / 29;
const LAB_DELTA3 = LAB_DELTA ** 3;

const linearize = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const delinearize = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

const labF = (t: number): number =>
  t > LAB_DELTA3 ? t ** (1 / 3) : t / (3 * LAB_DELTA ** 2) + 4 / 29;

const labFInv = (t: number): number =>
  t > LAB_DELTA ? t ** 3 : 3 * LAB_DELTA ** 2 * (t - 4 / 29);

// Expects normalized (0-1) RGB. Returns Lab [L 0-100, a, b].
export const rgbToLab = ([r, g, b]: RgbPixel): [number, number, number] => {
  const lr = linearize(r);
  const lg = linearize(g);
  const lb = linearize(b);

  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / D65.x;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb) / D65.y;
  const z = (0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb) / D65.z;

  const fy = labF(y);
  return [116 * fy - 16, 500 * (labF(x) - fy), 200 * (fy - labF(z))];
};

// Returns normalized (0-1) RGB, clamped.
export const labToRgb = ([L, a, b]: [number, number, number]): RgbPixel => {
  const fy = (L + 16) / 116;
  const x = D65.x * labFInv(fy + a / 500);
  const y = D65.y * labFInv(fy);
  const z = D65.z * labFInv(fy - b / 200);

  const lr =  3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const lg = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  const lb =  0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  return [
    Math.max(0, Math.min(1, delinearize(lr))),
    Math.max(0, Math.min(1, delinearize(lg))),
    Math.max(0, Math.min(1, delinearize(lb))),
  ];
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
