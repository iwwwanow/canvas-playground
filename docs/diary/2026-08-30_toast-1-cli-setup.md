# 2026-08-30 — toast-1: CLI, инфраструктура, первый рендер, blur, lch-hue, tint

Первая сессия на ветке `feat/toast-1`. Подняли пакет `toasts`, подключили `lib` как workspace-зависимость, написали CLI и получили первый рендер. Вторая сессия — расширили lib: blur, lch-hue blend mode, tint.

## Что сделали

### Workspace и package.json

- `packages/lib/package.json` — `@xtc-toaster/lib`, `"main": "./main.ts"`, добавлена зависимость `canvas ^3.2.3`
- `packages/toasts/package.json` — `@xtc-toaster/toasts`, `"@xtc-toaster/lib": "workspace:*"` в dependencies
- Корневой `package.json` уже имел `workspaces: ["packages/*"]` — не трогали

### Ассеты toast-1

```
packages/toasts/src/toasts/toast-1_degas/
  assets/
    degas-076.jpg      # 2000×1966 — полный размер
    degas-076.sm.jpg   # 250×246   — тест-вариант
```

Решение: ассеты лежат внутри тоста, а не на уровне пакета — тост самодостаточен.

### CLI

Корневой скрипт вызывает файл напрямую (не через `--filter`) — аргументы текут без `--`:

```bash
bun run toast-1                          # дефолт: degas-076.sm.jpg
bun run toast-1 --input ./image.jpg     # кастомный файл
```

Вывод: `tmp/outputs/{timestamp}_degas.png` (папка создаётся автоматически).

### Infrastructure в lib

Две функции в `packages/lib/infrastructure/index.ts`:

- `imageFileToRawData(path)` → `{ data: Uint8ClampedArray, width, height }` — через node-canvas (`loadImage` → `ctx.getImageData`)
- `rawDataToImageFile(data, dimensions, outputPath)` — через node-canvas (`ctx.putImageData` → `canvas.toBuffer('image/png')`)

`main.ts` теперь реэкспортирует и domain и infrastructure:
```ts
export * from "./domain";
export * from "./infrastructure";
```

### MaskParams — tolerance

Добавили опциональный `tolerance` во все три маски (`hue`, `saturation`, `value`) в `types.ts`, пробросили в `maskers.ts` и `layer.ts`. Дефолты остались прежними (HUE_TOLERANCE=0.02, SAT=0.1, VAL=0.1). Tolerance нормализован (0–1), не в градусах.

```ts
layer.mask({ name: "hue", value: 0, tolerance: 0.08 }); // ~29° полоса
```

### Первый рендер toast-1

Белый фон + слой с hue-маской (red, 0°) → PNG. Работает, выход проверен.

## Вторая сессия — расширение lib

### blur effect

`layer.applyEffect({ name: "blur", options: { radius: N } })` — separable box blur (горизонт. + вертикальный проход), O(n·r). Реализован в `effects.ts`, подключён в `layer.ts` через `this.dimensions`.

`EffectParams` стал union-типом:
```ts
| { name: "noize"; options: { deviationCoefficient: number; preserveAlpha: boolean } }
| { name: "blur"; options: { radius: number } }
```

### lch-hue blend mode

`layer.setBlendMode("lch-hue")` — берёт Hue из FG-слоя, Lightness и Chroma из BG. Реализован через RGB→Lab→LCh→Lab→RGB. Конвертации `rgbToLab`/`labToRgb` добавлены в `color-space.ts` (sRGB linearization → XYZ D65 → Lab). FG opacity управляет силой эффекта.

### tint

`layer.tint(color)` — заливает RGB фиксированным цветом, **не трогает альфу**. Нужен для работы поверх маски: маска ставит альфа-вес, tint красит цвет не разрушая его.

```ts
layer.mask({ name: "value", value: 10, tolerance: 0.6 });
layer.tint(Color.fromHex("#FF00FF")); // сохраняет alpha от маски
```

### Текущая композиция toast-1

```
darkGray background
+ blurredLayer (original image, blur r=2, opacity 0.6)
+ lightGray background (opacity 0.8)
+ blueBackground (#00ffdd, lch-hue, opacity 0.8)
+ purpleGradientLayer (value mask 10 ±0.6, tint #FF00FF, opacity 0.2)
// TODO: смещение слоя
```

## Остаток

- Смещение/трансформация слоя — следующий шаг (в `index.ts` есть `// TODO: rotation move layer`)
- Нет флага `--output` в CLI
- `CanvasRenderer` для браузерного вывода — техдолг
- Превью в терминале не работает внутри Zellij (см. `docs/backlog/2026-08-30_zellij-kitty-graphics-protocol.md`)
