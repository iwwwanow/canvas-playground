import type { ToastOutput, ProgressFn } from "./index";

export interface MosaicSegmentParams {
  k?: number;         // number of color clusters (default 8)
  cellSize?: number;  // grid cell size in pixels (default 32)
  iterations?: number; // k-means iterations (default 20)
}

export interface Segment {
  x: number;
  y: number;
  width: number;
  height: number;
  clusterId: number;
  color: [number, number, number]; // cluster centroid RGB
}

type RGB = [number, number, number];

function colorDistSq(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function kmeans(
  points: RGB[],
  k: number,
  iterations: number,
): { assignments: number[]; centroids: RGB[] } {
  // k-means++ initialization
  const centroids: RGB[] = [points[Math.floor(Math.random() * points.length)]];

  for (let c = 1; c < k; c++) {
    const dists = points.map((p) =>
      centroids.reduce((min, cen) => Math.min(min, colorDistSq(p, cen)), Infinity),
    );
    const total = dists.reduce((s, d) => s + d, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { idx = i; break; }
    }
    centroids.push([...points[idx]] as RGB);
  }

  const assignments = new Array<number>(points.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      let minDist = Infinity;
      let nearest = 0;
      for (let c = 0; c < k; c++) {
        const d = colorDistSq(points[i], centroids[c]);
        if (d < minDist) { minDist = d; nearest = c; }
      }
      if (nearest !== assignments[i]) { assignments[i] = nearest; changed = true; }
    }
    if (!changed) break;

    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < points.length; i++) {
      const c = assignments[i];
      sums[c][0] += points[i][0];
      sums[c][1] += points[i][1];
      sums[c][2] += points[i][2];
      counts[c]++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c] = [
          sums[c][0] / counts[c],
          sums[c][1] / counts[c],
          sums[c][2] / counts[c],
        ] as RGB;
      }
    }
  }

  return { assignments, centroids };
}

export function segment(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: MosaicSegmentParams = {},
): Segment[] {
  const { k = 8, cellSize = 32, iterations = 20 } = params;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);

  // Average RGB per cell
  const cellColors: RGB[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * cellSize;
      const y0 = row * cellSize;
      const x1 = Math.min(x0 + cellSize, width);
      const y1 = Math.min(y0 + cellSize, height);
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2];
          count++;
        }
      }
      cellColors.push([r / count, g / count, b / count]);
    }
  }

  const effectiveK = Math.min(k, cellColors.length);
  const { assignments, centroids } = kmeans(cellColors, effectiveK, iterations);

  const segments: Segment[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellIdx = row * cols + col;
      const clusterId = assignments[cellIdx];
      const color = centroids[clusterId].map(Math.round) as RGB;
      segments.push({
        x: col * cellSize,
        y: row * cellSize,
        width: Math.min(cellSize, width - col * cellSize),
        height: Math.min(cellSize, height - row * cellSize),
        clusterId,
        color,
      });
    }
  }

  return segments;
}

export const meta = {
  slug: "mosaic-segment",
  name: "Mosaic Segment",
  description: "Segment image into color regions using k-means. Outputs a debug visualization.",
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
  const { cellSize = 32 } = params;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);

  onProgress?.(0, 3, "segmenting");
  const segments = segment(data, width, height, params);
  onProgress?.(1, 3, "segmenting");

  const out = new Uint8ClampedArray(width * height * 4);

  // Paint each segment cell with its cluster color
  for (const seg of segments) {
    const [cr, cg, cb] = seg.color;
    for (let y = seg.y; y < seg.y + seg.height; y++) {
      for (let x = seg.x; x < seg.x + seg.width; x++) {
        const i = (y * width + x) * 4;
        out[i] = cr; out[i + 1] = cg; out[i + 2] = cb; out[i + 3] = 255;
      }
    }
  }

  onProgress?.(2, 3, "segmenting");

  // Draw borders: 1px black line between cells of different clusters
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellIdx = row * cols + col;
      const thisCluster = segments[cellIdx].clusterId;

      // Right neighbor
      if (col + 1 < cols && segments[row * cols + col + 1].clusterId !== thisCluster) {
        const bx = (col + 1) * cellSize;
        const y0 = row * cellSize;
        const y1 = Math.min(y0 + cellSize, height);
        for (let y = y0; y < y1 && bx < width; y++) {
          const i = (y * width + bx) * 4;
          out[i] = out[i + 1] = out[i + 2] = 0; out[i + 3] = 255;
        }
      }

      // Bottom neighbor
      if (row + 1 < rows && segments[(row + 1) * cols + col].clusterId !== thisCluster) {
        const by = (row + 1) * cellSize;
        const x0 = col * cellSize;
        const x1 = Math.min(x0 + cellSize, width);
        for (let x = x0; x < x1 && by < height; x++) {
          const i = (by * width + x) * 4;
          out[i] = out[i + 1] = out[i + 2] = 0; out[i + 3] = 255;
        }
      }
    }
  }

  onProgress?.(3, 3, "segmenting");

  return { type: "image", data: out };
}
