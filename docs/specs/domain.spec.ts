// не хочу делать на этом уровне связку с canvas из браузерного слоя. лишнее
class Composition {
  constructor(
    private width: number,
    private height: number,
    private layers: [Layer],
  ) {}

  // не нравится нейминг. может сразу создавать слой? наверно лучше так. да
  addLayer(pixelData: Uint8Array) {}
  duplicateLayer(layer: Layer) {}

  // - clearLayers()

  render(): ImageRawDataArray {}
}

class Layer {
  constructor(
    private imageData: ImageRawDataArray,
    private effects: Array<Effect>,
  ) {}

  // TODO: one of:
  private applyEffects() {}
  // TODO: one of:
  private renderLayer() {}

  // TODO: or merge it with one method - setOption?
  // TODO: can i init layer with that options?
  // по сути это layerSetting. должно храниться в настройках лейера. вопрос в том - вызывается ли точечно и изолированно?
  setBlendMode(blendMode: BlendMode) {}

  // TODO: can i init layer with that options?
  setTransform() {}

  fill(color: Color) {}
  // TODO: is it layer methods or composition?
  // - cutChannel/cutHue/cutValue/cutSaturation(data, ...) — тонкие прокси к cutters

  // - clearLayer()
  // выглядит как эффект
  // - addHueNoize({ deviationCoefficient, preserveAlpha }) (private) — RGB→HSL, шум по hue, обратно в RGB
}

class Color {
  constructor(
    { hex, rgb, rbga },
    { hex: HexString, rbg: RgbArray, rgbaArray: RgbaArray },
  ) {}
}

// сейчас у меня сделан интерфейс, но походу нужно сделать класс да.
// вопрос в том, что такое тогда Color. это цвет одного пикселя или единица в массиве пикселя (красный, синий, зеленый)
// Pixel (pixel.class.ts) — обёртка одного пикселя
// - поля: c (Color 0-255), nc (NormalColor 0-1)
// - constructor(pixelData: number[])
// - static getDataFromUintArray(pixelIndex, layerData) → [r,g,b,a]

// это вообще не выглядт как отдельная сущность. на сервисы разбить, да?
// Transformation (transformation.class.ts) — аффинные трансформации через матрицы
// - поля: type, params, affineMatrix
// - constructor({ type, params })
// - process(data, width, height) — прогоняет все пиксели через матрицу (forward-mapping, есть дыры при round)
// - setAffineMatrix(type) (private), getSkewMatrix/getScaleMatrix/getRotateMatrix/getTranslateMatrix (private)

class Effect {
  constructor(
    name: string,
    // TODO: prop name?
    options: Object,
  ) {}
}

// TODO: naming wrong;
type ImageRawDataArray = Uint8Array;
type HexString = string;
type RgbArray = [RgbPixel];
type RgbaArray = [RgbaPixel];
type RgbPixel = [number, number, number];
type RgbaPixel = [number, number, number, number];
type BlendMode = "bla" | "bla2";

// TODO: нарежь мне также domain-services исходя из legacy-функционала. просто сигнатуры их и по категориям разбей
