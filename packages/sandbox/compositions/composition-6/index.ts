import "../shared/recorder";
import { Composition, Layer, LayerEffect, BlendMod } from "@xtc-toaster/core";

const CANVAS_ID = "canvas-6";
const IMG_QUERY_SELECTOR = "#source-6";
const IMAGE_WIDTH = 595;
const IMAGE_HEIGHT = 420;

const channels = [
  { min: 320, max: 350, step: 0.5, noize: 0.05, frames: 30 },
  { min: 8, max: 32, step: 0.25, noize: 0.01, frames: 48 },

  { min: 120, max: 200, step: 0.667, noize: 0.05, frames: 60 }, // green
  { min: 40, max: 120, step: 0.667, noize: 0.05, frames: 60 }, // green

  { min: 200, max: 240, step: 0.333, noize: 0.08, frames: 120 }, // blue
];

/**
 * Перспективный поворот вокруг оси Y — обратное отображение.
 * Для каждого выходного пикселя (x, y) находим исходный пиксель:
 *
 *   Прямое проецирование (f = focalLength):
 *     x' = cx + (x−cx)·cos(a)·f / (f + (x−cx)·sin(a))
 *     y' = cy + (y−cy)·f        / (f + (x−cx)·sin(a))
 *
 *   Обратное (dx' = x'−cx, dy' = y'−cy):
 *     denom  = f − dx'·tan(a)
 *     x_src  = cx + dx'·f / (cos(a)·denom)
 *     y_src  = cy + dy'·f / denom
 */
function applyYRotationPerspective(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  angleRad: number,
  focalLength: number = 600,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length); // прозрачно по умолчанию
  const cx = width / 2;
  const cy = height / 2;
  const tanA = Math.tan(angleRad);
  const cosA = Math.cos(angleRad);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const denom = focalLength - dx * tanA;

      // denom <= 0 — пиксель за камерой, пропускаем
      if (denom <= 0) continue;

      const srcX = cx + (dx * focalLength) / (cosA * denom);
      const srcY = cy + (dy * focalLength) / denom;

      const sx = Math.round(srcX);
      const sy = Math.round(srcY);

      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

      const srcIdx = (sy * width + sx) * 4;
      const dstIdx = (y * width + x) * 4;

      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }

  return dst;
}

const drawPoppies2 = () => {
  const composition = new Composition({
    canvasId: CANVAS_ID,
    imgQuerySelector: IMG_QUERY_SELECTOR,
    options: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
  });

  composition.init();

  const originalImageData = composition.imageData?.data;
  if (!originalImageData) throw new Error("image data not defined");

  // grayscale base layer — computed once
  const grayscaleData = new Uint8ClampedArray(originalImageData.length);
  for (let i = 0; i < originalImageData.length; i += 4) {
    const l = Math.round(
      0.299 * originalImageData[i] +
        0.587 * originalImageData[i + 1] +
        0.114 * originalImageData[i + 2],
    );
    grayscaleData[i] = grayscaleData[i + 1] = grayscaleData[i + 2] = l;
    grayscaleData[i + 3] = originalImageData[i + 3];
  }
  const grayscaleLayer = new Layer(grayscaleData);

  const Y_MAX_ANGLE = Math.PI * 0.05;

  // float accumulators, one per channel
  const hues = channels.map((c) => c.min as number);
  // независимые счётчики вращения на каждый канал
  const rotFrames = channels.map(() => 0);

  const updateAnimation = () => {
    composition.clearLayers();
    // composition.addColorLayer("#ffffff");
    composition.addLayer(grayscaleLayer);

    channels.forEach(({ min, max, step, noize, frames }, i) => {
      const range = (max - min + 360) % 360;
      const hue = Math.round(hues[i]) % 360;

      // пилообразная волна: 0 → Y_MAX_ANGLE, сброс в 0
      const t = (rotFrames[i] % frames) / frames;
      const yAngle = t * Y_MAX_ANGLE;
      rotFrames[i]++;

      const data = composition.cutHue(originalImageData, hue);
      const layer = new Layer(data);
      layer.addEffect(LayerEffect.Noize, {
        deviationCoefficient: noize,
        preserveAlpha: true,
      });

      layer.setData(
        applyYRotationPerspective(
          layer.data,
          IMAGE_WIDTH,
          IMAGE_HEIGHT,
          yAngle,
        ),
      );

      // layer.setBlendMode(BlendMod.add);
      composition.addLayer(layer);

      hues[i] = min + ((hues[i] - min + step) % range);
    });

    composition.render();
    requestAnimationFrame(updateAnimation);
  };

  requestAnimationFrame(updateAnimation);
};

drawPoppies2();
