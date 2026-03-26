import type { ToastOutput, ProgressFn } from "./index";

export interface MosaicSegmentParams {
  k?: number;              // number of color clusters (default 8)
  cellSize?: number;       // grid cell size in pixels (default 32)
  iterations?: number;     // k-means iterations (default 20)
  gradientThreshold?: number; // min gradient magnitude to apply rotation (0–255, default 15)
  maxAngle?: number;       // max rectangle tilt in degrees (default 40)
}

export interface Segment {
  x: number;         // bounding box top-left (unrotated cell origin)
  y: number;
  width: number;     // cell width
  height: number;    // cell height
  cx: number;        // center x
  cy: number;        // center y
  angle: number;     // rotation angle in degrees (along dominant edge direction)
  clusterId: number;
  color: [number, number, number]; // cluster centroid RGB
}

type RGB = [number, number, number];

// ─── Color math ─────────────────────────────────────────────────────────────

function colorDistSq(a: RGB, b: RGB): number {
  return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
}

function kmeans(points: RGB[], k: number, iterations: number): { assignments: number[]; centroids: RGB[] } {
  const centroids: RGB[] = [points[Math.floor(Math.random() * points.length)]];
  for (let c = 1; c < k; c++) {
    const dists = points.map(p => centroids.reduce((min, cen) => Math.min(min, colorDistSq(p, cen)), Infinity));
    const total = dists.reduce((s, d) => s + d, 0);
    let r = Math.random() * total, idx = 0;
    for (let i = 0; i < dists.length; i++) { r -= dists[i]; if (r <= 0) { idx = i; break; } }
    centroids.push([...points[idx]] as RGB);
  }

  const assignments = new Array<number>(points.length).fill(0);
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      let minD = Infinity, nearest = 0;
      for (let c = 0; c < k; c++) {
        const d = colorDistSq(points[i], centroids[c]);
        if (d < minD) { minD = d; nearest = c; }
      }
      if (nearest !== assignments[i]) { assignments[i] = nearest; changed = true; }
    }
    if (!changed) break;
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < points.length; i++) {
      const c = assignments[i];
      sums[c][0] += points[i][0]; sums[c][1] += points[i][1]; sums[c][2] += points[i][2];
      counts[c]++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) centroids[c] = sums[c].map(v => v / counts[c]) as RGB;
    }
  }
  return { assignments, centroids };
}

// ─── Gradient ───────────────────────────────────────────────────────────────

/** Compute per-pixel Sobel gradient on luminance channel.
 *  Returns [gx, gy] arrays (Float32 for speed). */
function computeSobel(data: Uint8ClampedArray, width: number, height: number): { gx: Float32Array; gy: Float32Array } {
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);

  // luminance helper
  const lum = (x: number, y: number): number => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = lum(x-1,y-1), tm = lum(x,y-1), tr = lum(x+1,y-1);
      const ml = lum(x-1,y),                     mr = lum(x+1,y);
      const bl = lum(x-1,y+1), bm = lum(x,y+1), br = lum(x+1,y+1);

      const gxVal = -tl + tr - 2*ml + 2*mr - bl + br;
      const gyVal = -tl - 2*tm - tr + bl + 2*bm + br;

      const idx = y * width + x;
      gx[idx] = gxVal;
      gy[idx] = gyVal;
    }
  }
  return { gx, gy };
}

/** Average gradient vector over a cell region.
 *  Returns { angle (degrees), magnitude }. */
function cellGradient(
  gx: Float32Array, gy: Float32Array,
  width: number,
  x0: number, y0: number, x1: number, y1: number,
): { angle: number; magnitude: number } {
  let sumGx = 0, sumGy = 0, count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      sumGx += gx[i]; sumGy += gy[i]; count++;
    }
  }
  if (count === 0) return { angle: 0, magnitude: 0 };
  const avgGx = sumGx / count;
  const avgGy = sumGy / count;
  const magnitude = Math.sqrt(avgGx ** 2 + avgGy ** 2);
  // Edge direction = perpendicular to gradient (+90°)
  const angleRad = Math.atan2(avgGy, avgGx) + Math.PI / 2;
  return { angle: (angleRad * 180) / Math.PI, magnitude };
}

// ─── Segment ─────────────────────────────────────────────────────────────────

export function segment(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: MosaicSegmentParams = {},
): Segment[] {
  const { k = 8, cellSize = 32, iterations = 20, gradientThreshold = 15, maxAngle = 40 } = params;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);

  // Compute gradient for the whole image once
  const { gx, gy } = computeSobel(data, width, height);

  // Per-cell: average color + gradient angle
  const cellColors: RGB[] = [];
  const cellAngles: number[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * cellSize, y0 = row * cellSize;
      const x1 = Math.min(x0 + cellSize, width);
      const y1 = Math.min(y0 + cellSize, height);

      // Average color
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          r += data[i]; g += data[i+1]; b += data[i+2];
          count++;
        }
      }
      cellColors.push([r/count, g/count, b/count]);

      // Gradient-based angle
      const { angle, magnitude } = cellGradient(gx, gy, width, x0, y0, x1, y1);
      // Only apply tilt if gradient is strong enough
      if (magnitude > gradientThreshold) {
        // Clamp to ±maxAngle
        const clamped = Math.max(-maxAngle, Math.min(maxAngle, angle));
        cellAngles.push(clamped);
      } else {
        cellAngles.push(0);
      }
    }
  }

  // k-means on cell colors
  const effectiveK = Math.min(k, cellColors.length);
  const { assignments, centroids } = kmeans(cellColors, effectiveK, iterations);

  const segments: Segment[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellIdx = row * cols + col;
      const x0 = col * cellSize, y0 = row * cellSize;
      const w = Math.min(cellSize, width - x0);
      const h = Math.min(cellSize, height - y0);
      const clusterId = assignments[cellIdx];
      const color = centroids[clusterId].map(Math.round) as RGB;

      segments.push({
        x: x0,
        y: y0,
        width: w,
        height: h,
        cx: x0 + w / 2,
        cy: y0 + h / 2,
        angle: cellAngles[cellIdx],
        clusterId,
        color,
      });
    }
  }

  return segments;
}

// ─── Debug visualization ─────────────────────────────────────────────────────

/** Bresenham line draw into RGBA buffer. */
function drawLine(
  out: Uint8ClampedArray, width: number, height: number,
  x0: number, y0: number, x1: number, y1: number,
  r: number, g: number, b: number,
): void {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let cx = Math.round(x0), cy = Math.round(y0);

  for (let steps = 0; steps < 4096; steps++) {
    if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
      const i = (cy * width + cx) * 4;
      out[i] = r; out[i+1] = g; out[i+2] = b; out[i+3] = 255;
    }
    if (cx === Math.round(x1) && cy === Math.round(y1)) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; cx += sx; }
    if (e2 <= dx) { err += dx; cy += sy; }
  }
}

/** Draw rotated rectangle outline onto raw RGBA buffer. */
function drawRotatedRect(
  out: Uint8ClampedArray, imgWidth: number, imgHeight: number,
  cx: number, cy: number, w: number, h: number,
  angleDeg: number,
  r: number, g: number, b: number,
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
    drawLine(out, imgWidth, imgHeight, ax, ay, bx, by, r, g, b);
  }
}

export const meta = {
  slug: "mosaic-segment",
  name: "Mosaic Segment",
  description: "Segment image into tonal regions using gradient-aware k-means. Outputs debug visualization.",
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
  onProgress?.(0, 3, "computing gradient");
  const segs = segment(data, width, height, params);
  onProgress?.(1, 3, "drawing segments");

  // Start with a darkened copy of the original image as background
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    out[i]   = Math.round(data[i]   * 0.4);
    out[i+1] = Math.round(data[i+1] * 0.4);
    out[i+2] = Math.round(data[i+2] * 0.4);
    out[i+3] = 255;
  }

  // Draw each rectangle: filled with cluster color + outline
  for (const seg of segs) {
    const rad = (seg.angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const hw = seg.width / 2, hh = seg.height / 2;
    const [cr, cg, cb] = seg.color;

    // Fill rotated rect pixels
    for (let ly = -hh; ly <= hh; ly++) {
      for (let lx = -hw; lx <= hw; lx++) {
        const px = Math.round(seg.cx + lx * cos - ly * sin);
        const py = Math.round(seg.cy + lx * sin + ly * cos);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const i = (py * width + px) * 4;
          out[i] = cr; out[i+1] = cg; out[i+2] = cb; out[i+3] = 200;
        }
      }
    }

    // Draw white border
    drawRotatedRect(out, width, height, seg.cx, seg.cy, seg.width, seg.height, seg.angle, 255, 255, 255);
  }

  onProgress?.(3, 3, "done");
  return { type: "image", data: out };
}
