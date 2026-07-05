/**
 * Перспективный поворот вокруг оси Y — обратное отображение.
 *
 * Прямое проецирование (f = focalLength):
 *   x' = cx + (x−cx)·cos(a)·f / (f + (x−cx)·sin(a))
 *   y' = cy + (y−cy)·f        / (f + (x−cx)·sin(a))
 *
 * Обратное (dx' = x'−cx, dy' = y'−cy):
 *   denom  = f − dx'·tan(a)
 *   x_src  = cx + dx'·f / (cos(a)·denom)
 *   y_src  = cy + dy'·f / denom
 */
export function applyYRotationPerspective(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  angleRad: number,
  focalLength: number = 600,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  const cx = width / 2;
  const cy = height / 2;
  const tanA = Math.tan(angleRad);
  const cosA = Math.cos(angleRad);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const denom = focalLength - dx * tanA;

      if (denom <= 0) continue;

      const srcX = cx + (dx * focalLength) / (cosA * denom);
      const srcY = cy + (dy * focalLength) / denom;

      const sx = Math.round(srcX);
      const sy = Math.round(srcY);

      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

      const srcIdx = (sy * width + sx) * 4;
      const dstIdx = (y * width + x) * 4;

      dst[dstIdx]     = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return dst;
}
