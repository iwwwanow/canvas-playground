import { rgbToHsv } from "../utils/rgb-to-hsv.util";
import type { ToastOutput, ProgressFn } from "./index";

export interface MosaicSegmentParams {
  tones?: number;          // tone (Value) quantization levels (default 6)
  hues?: number;           // hue quantization levels (default 6)
  minRegionSize?: number;  // min pixels per region, smaller are discarded (default 200)
  maxAspect?: number;      // max rectangle aspect ratio, e.g. 7 means 7:1 (default 7)
  overshoot?: number;      // allowed overshoot beyond region boundary, 0–1 (default 0.08)
}

export interface Segment {
  cx: number;        // center x
  cy: number;        // center y
  width: number;     // extent along major axis (long side)
  height: number;    // extent along minor axis (short side)
  angle: number;     // major axis angle in degrees (from positive X axis)
  clusterId: number; // posterized color class index
  color: [number, number, number]; // approximate RGB of this region
  pixelCount: number;
}

// ─── Posterization ─────────────────────────────────────────────────────────

/** Quantize a single pixel to a color class integer.
 *  Low-saturation pixels (grays) are assigned to a separate gray band. */
function posterizePixel(r: number, g: number, b: number, tones: number, hues: number): number {
  const [h, s, v] = rgbToHsv([r, g, b]);
  const valueLevel = Math.min(tones - 1, Math.floor((v / 100) * tones));

  if (s < 15) {
    // Achromatic / near-gray → extra classes beyond hues*tones
    return hues * tones + valueLevel;
  }

  const hueLevel = Math.floor((h / 360) * hues) % hues;
  return hueLevel * tones + valueLevel;
}

/** Return the approximate center RGB for a color class. */
function classToRgb(
  colorClass: number,
  tones: number,
  hues: number,
): [number, number, number] {
  const totalChroma = hues * tones;
  if (colorClass >= totalChroma) {
    // Gray class
    const vLevel = colorClass - totalChroma;
    const v = Math.round(((vLevel + 0.5) / tones) * 255);
    return [v, v, v];
  }
  const hueLevel = Math.floor(colorClass / tones);
  const vLevel = colorClass % tones;
  const h = ((hueLevel + 0.5) / hues) * 360;
  const v = (vLevel + 0.5) / tones;
  const s = 0.7;
  // HSV → RGB
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, bv = 0;
  if (h < 60)        { r = c; g = x; }
  else if (h < 120)  { r = x; g = c; }
  else if (h < 180)  { g = c; bv = x; }
  else if (h < 240)  { g = x; bv = c; }
  else if (h < 300)  { r = x; bv = c; }
  else               { r = c; bv = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((bv + m) * 255),
  ];
}

// ─── Connected components (BFS, 4-connectivity) ────────────────────────────

function findComponents(
  classes: Int32Array,
  width: number,
  height: number,
): Map<number, number[]> {
  // Returns: componentId → flat array of pixel indices [idx0, idx1, ...]
  const visited = new Uint8Array(width * height);
  const components = new Map<number, number[]>();
  let compId = 0;

  const queue = new Int32Array(width * height);

  for (let startIdx = 0; startIdx < width * height; startIdx++) {
    if (visited[startIdx]) continue;

    const cls = classes[startIdx];
    visited[startIdx] = 1;

    const pixels: number[] = [startIdx];
    let head = 0, tail = 0;
    queue[tail++] = startIdx;

    while (head < tail) {
      const idx = queue[head++];
      const x = idx % width;
      const y = Math.floor(idx / width);

      const neighbors = [
        x > 0          ? idx - 1     : -1,
        x < width - 1  ? idx + 1     : -1,
        y > 0          ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];

      for (const n of neighbors) {
        if (n >= 0 && !visited[n] && classes[n] === cls) {
          visited[n] = 1;
          queue[tail++] = n;
          pixels.push(n);
        }
      }
    }

    components.set(compId++, pixels);
  }

  return components;
}

// ─── PCA rectangle fitting ──────────────────────────────────────────────────

interface FittedRect {
  cx: number;
  cy: number;
  width: number;   // major axis extent (long side)
  height: number;  // minor axis extent (short side)
  angle: number;   // major axis angle in degrees
}

function fitRect(
  pixels: number[],
  imageWidth: number,
  maxAspect: number,
  overshoot: number,
): FittedRect {
  const n = pixels.length;

  // Centroid
  let sumX = 0, sumY = 0;
  for (const idx of pixels) {
    sumX += idx % imageWidth;
    sumY += Math.floor(idx / imageWidth);
  }
  const cx = sumX / n;
  const cy = sumY / n;

  // Covariance matrix
  let covXX = 0, covYY = 0, covXY = 0;
  for (const idx of pixels) {
    const dx = (idx % imageWidth) - cx;
    const dy = Math.floor(idx / imageWidth) - cy;
    covXX += dx * dx;
    covYY += dy * dy;
    covXY += dx * dy;
  }
  covXX /= n; covYY /= n; covXY /= n;

  // 2×2 eigenvalue decomposition
  const trace = covXX + covYY;
  const det = covXX * covYY - covXY * covXY;
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const lambda1 = trace / 2 + disc; // larger eigenvalue → major axis

  // Major eigenvector
  let ex = 1, ey = 0;
  if (Math.abs(covXY) > 1e-8) {
    ex = lambda1 - covYY;
    ey = covXY;
    const len = Math.sqrt(ex * ex + ey * ey);
    ex /= len; ey /= len;
  } else if (covYY > covXX) {
    ex = 0; ey = 1;
  }

  // Minor axis (perpendicular)
  const minX = -ey, minY = ex;

  // Project all pixels onto both axes
  let minMajor = Infinity, maxMajor = -Infinity;
  let minMinor = Infinity, maxMinor = -Infinity;
  for (const idx of pixels) {
    const dx = (idx % imageWidth) - cx;
    const dy = Math.floor(idx / imageWidth) - cy;
    const projMajor = dx * ex + dy * ey;
    const projMinor = dx * minX + dy * minY;
    if (projMajor < minMajor) minMajor = projMajor;
    if (projMajor > maxMajor) maxMajor = projMajor;
    if (projMinor < minMinor) minMinor = projMinor;
    if (projMinor > maxMinor) maxMinor = projMinor;
  }

  let extMajor = (maxMajor - minMajor) * (1 + overshoot);
  let extMinor = (maxMinor - minMinor) * (1 + overshoot);

  // Ensure minimum size of 2px each side
  extMajor = Math.max(extMajor, 4);
  extMinor = Math.max(extMinor, 4);

  // Clamp aspect ratio to maxAspect:1
  if (extMajor / extMinor > maxAspect) {
    extMajor = extMinor * maxAspect;
  } else if (extMinor / extMajor > maxAspect) {
    extMinor = extMajor * maxAspect;
  }

  const angle = (Math.atan2(ey, ex) * 180) / Math.PI;

  return { cx, cy, width: extMajor, height: extMinor, angle };
}

// ─── Main segment function ──────────────────────────────────────────────────

export function segment(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: MosaicSegmentParams = {},
): Segment[] {
  const {
    tones = 6,
    hues = 6,
    minRegionSize = 200,
    maxAspect = 7,
    overshoot = 0.08,
  } = params;

  const totalPixels = width * height;

  // Step 1: Posterize every pixel → color class
  const classes = new Int32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    classes[i] = posterizePixel(r, g, b, tones, hues);
  }

  // Step 2: Connected components
  const components = findComponents(classes, width, height);

  // Step 3: Fit rectangle to each component
  const segments: Segment[] = [];

  for (const [, pixels] of components) {
    if (pixels.length < minRegionSize) continue;

    const colorClass = classes[pixels[0]];
    const color = classToRgb(colorClass, tones, hues);
    const rect = fitRect(pixels, width, maxAspect, overshoot);

    segments.push({
      cx: rect.cx,
      cy: rect.cy,
      width: rect.width,
      height: rect.height,
      angle: rect.angle,
      clusterId: colorClass,
      color,
      pixelCount: pixels.length,
    });
  }

  return segments;
}

// ─── Visualization ──────────────────────────────────────────────────────────

function drawLine(
  out: Uint8ClampedArray, w: number, h: number,
  x0: number, y0: number, x1: number, y1: number,
  r: number, g: number, b: number,
): void {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let cx = Math.round(x0), cy = Math.round(y0);

  for (let steps = 0; steps < 8192; steps++) {
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
      const i = (cy * w + cx) * 4;
      out[i] = r; out[i+1] = g; out[i+2] = b; out[i+3] = 255;
    }
    if (cx === Math.round(x1) && cy === Math.round(y1)) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; cx += sx; }
    if (e2 <= dx) { err += dx; cy += sy; }
  }
}

function drawRotatedRect(
  out: Uint8ClampedArray, imgW: number, imgH: number,
  cx: number, cy: number, w: number, h: number,
  angleDeg: number, r: number, g: number, b: number,
): void {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const hw = w / 2, hh = h / 2;

  const corners: [number, number][] = [
    [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
  ].map(([lx, ly]) => [
    cx + lx * cos - ly * sin,
    cy + lx * sin + ly * cos,
  ]) as [number, number][];

  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    drawLine(out, imgW, imgH, ax, ay, bx, by, r, g, b);
  }
}

/** Draw segment outlines on the original frame (no fill, no recomputation). */
export function visualize(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  segs: Segment[],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data); // copy original
  for (const seg of segs) {
    // Shadow border (1px larger, black)
    drawRotatedRect(out, width, height, seg.cx, seg.cy, seg.width + 2, seg.height + 2, seg.angle, 0, 0, 0);
    // White outline
    drawRotatedRect(out, width, height, seg.cx, seg.cy, seg.width, seg.height, seg.angle, 255, 255, 255);
  }
  return out;
}

// ─── Toast bake (debug output) ───────────────────────────────────────────────

export const meta = {
  slug: "mosaic-segment",
  name: "Mosaic Segment",
  description:
    "Posterize image into tonal/hue regions, fit oriented bounding rectangles. Debug visualization.",
  outputType: "image" as const,
};

export function bake(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: MosaicSegmentParams = {},
  _outputPath?: string,
  onProgress?: ProgressFn,
): ToastOutput {
  onProgress?.(0, 3, "posterizing");
  const segs = segment(data, width, height, params);
  onProgress?.(1, 3, "drawing");

  // Posterized background + outlines
  const out = new Uint8ClampedArray(width * height * 4);
  const { tones = 6, hues = 6 } = params;

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const cls = posterizePixel(r, g, b, tones, hues);
    const [pr, pg, pb] = classToRgb(cls, tones, hues);
    out[i * 4] = pr; out[i * 4 + 1] = pg; out[i * 4 + 2] = pb; out[i * 4 + 3] = 255;
  }

  for (const seg of segs) {
    drawRotatedRect(out, width, height, seg.cx, seg.cy, seg.width + 2, seg.height + 2, seg.angle, 0, 0, 0);
    drawRotatedRect(out, width, height, seg.cx, seg.cy, seg.width, seg.height, seg.angle, 255, 255, 255);
  }

  onProgress?.(3, 3, "done");
  return { type: "image", data: out };
}
