import { BlendMod } from "./composition.interfaces";
import type { LayerOptions, TransformType } from "./layer.interfaces";

export class Layer {
  options?: LayerOptions = {};
  data: Uint8ClampedArray;

  constructor(data: Uint8ClampedArray, options?: LayerOptions) {
    this.data = data;
    this.options = options;
  }

  setBlendMode(blendMod: BlendMod) {
    if (!this.options) this.options = {};
    this.options.blendMod = blendMod;
  }

  // TODO: ummutable or mutable?
  setData(data: Uint8ClampedArray) {
    this.data = data;
  }

  setOpacity(opacity: number) {
    if (!this.options) this.options = {};
    this.options.opacity = opacity;
  }

  setTransform(type: TransformType, x, y) {
    if (!this.options) this.options = {};
    if (!this.options.transform) this.options.transform = { type, x, y };
  }

  // TODO: refactor
  addHueNoize(
    deviationCoefficient: number = 0.1,
    preserveAlpha: boolean = true,
  ) {
    if (deviationCoefficient < 0 || deviationCoefficient > 1) {
      throw new Error("deviationCoefficient должен быть в диапазоне 0-1");
    }

    const output = new Uint8ClampedArray(this.data.length);

    for (let i = 0; i < this.data.length; i += 4) {
      const r = this.data[i] / 255;
      const g = this.data[i + 1] / 255;
      const b = this.data[i + 2] / 255;
      const a = this.data[i + 3] / 255;

      // 1. Конвертируем RGB в HSL
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0,
        s = 0,
        l = (max + min) / 2;

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
        h /= 6; // Нормализуем к 0-1
      }

      // 2. Добавляем шум к hue
      // Генерируем случайное отклонение от -deviationCoefficient до +deviationCoefficient
      const noise = (Math.random() * 2 - 1) * deviationCoefficient;
      h = (h + noise) % 1.0;
      if (h < 0) h += 1.0; // Корректируем отрицательные значения

      // 3. Конвертируем HSL обратно в RGB
      const { r: newR, g: newG, b: newB } = this.hslToRgb(h, s, l);

      // 4. Записываем результат
      output[i] = Math.round(newR * 255);
      output[i + 1] = Math.round(newG * 255);
      output[i + 2] = Math.round(newB * 255);
      output[i + 3] = preserveAlpha ? Math.round(a * 255) : this.data[i + 3];
    }

    this.data = output;
  }

  /**
   * Конвертирует HSL в RGB
   * @param h - hue (0-1)
   * @param s - saturation (0-1)
   * @param l - lightness (0-1)
   * @returns объект с r,g,b в диапазоне 0-1
   */
  private hslToRgb(
    h: number,
    s: number,
    l: number,
  ): { r: number; g: number; b: number } {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // Оттенки серого
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return { r, g, b };
  }
}
