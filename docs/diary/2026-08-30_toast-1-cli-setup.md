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

## Третья сессия — perspective transform, матрица гомографии

### Matrix.inverse

Добавлен `Matrix.inverse(m)` — статический метод, cofactor/adjugate для 3×3. В `matrix.ts`.

### Perspective и homography transforms

Два новых варианта `Transform` в `types.ts`:

```ts
| { name: "homography"; params: { matrix: number[] } }   // 9 элементов, row-major 3×3
| { name: "perspective"; params: { corners: Quad } }     // TL TR BR BL по часовой
```

`Quad = [Point2D, Point2D, Point2D, Point2D]` — тоже в `types.ts`.

В `transforms.ts` добавлены:
- `gaussianElimination` — решение 8×8 системы с частичным пивотингом
- `homographyFromPairs` — вычисляет матрицу H из 4 пар src→dst точек
- `homographyFromQuad(dimensions, corners)` — src-углы берёт из размеров слоя автоматически
- `applyHomographyTransform` — **backward mapping** (нет дырок, в отличие от старого affine forward)

Конвенция: `point*M` (row-vector слева), перенос в последней строке — как и везде в проекте.

`layer.setTransform` теперь диспатчит `homography` и `perspective` на новый путь, аффинные — по-старому.

### Важные детали

- `identity` Quad: `[{x:0,y:0}, {x:w-1,y:0}, {x:w-1,y:h-1}, {x:0,y:h-1}]`
- Все 4 угла в одну точку → singular system → crash. Нужен ненулевой четырёхугольник.
- Blur и translate в абсолютных пикселях — при смене разрешения масштабировать вручную через `width * coefficient`.

### Текущая композиция toast-1

```
darkGray background
+ blurredLayer (original image, blur radius пропорц. ширине, opacity 0.6)
+ lightGray background (opacity 0.8)
+ blueBackground (#00ffdd, lch-hue, opacity 0.8)
+ purpleGradientLayer (value mask 10 ±0.6, tint #FF00FF, opacity 0.2, perspective corners)
```

## Четвёртая сессия — анимация, ffmpeg, пресеты

### buildFrame(t) — factory-функция

Три анимированных слоя (purple, red, white) вынесены в `buildFrame(t: number)`, где `t ∈ [0, 1]`. Каждый кадр — отдельный `Composition`. Анимируются:

- `opacity` — умножается на `t`
- `perspective corners` — `gapModifier` умножается на `t` (отрицательный = наружу)
- `translate` — `tx/ty` умножаются на `t`

Нефиксированные параметры (blur radius, mask, tint) — константы, не зависят от кадра.

Нюанс по corners: `gapModifier > 0` → углы внутрь, `< 0` → наружу за границу изображения. При `gapModifier=0` — прямоугольник, валидная перспектива (не краш).

### ffmpeg в lib/infrastructure

`packages/lib/infrastructure/assemble-gif.ts` экспортирует:

- `assembleGif(frames, w, h, fps, path)` — raw RGBA pipe в ffmpeg, `palettegen+paletteuse` dither
- `assembleVideo(frames, w, h, fps, path)` — pipe в `libx264`, `yuv420p`, выравнивание до чётных размеров
- `loopVideoTo(inputPath, targetSeconds, outputPath, clipDuration)` — `-stream_loop N -c copy`, без перекодирования

`imageFileToRawData` получил второй аргумент `scale: number = 1.0` — скейлит через canvas при загрузке.

### Пресеты

Пресет = только `{ scale, format }`. `fps` и `frames` — отдельные CLI-флаги, одинаковые для любого пресета. Дефолты: 24fps, 24 кадра.

```
preview: { scale: 0.25, format: "gif" }
hd:      { scale: 0.5,  format: "mp4" }
2k:      { scale: 1.0,  format: "mp4" }
```

```bash
bun run toast-1 -- -i degas-076.jpg -p 2k --frames 36 --fps 36 --loop 15
```

`--loop N` — после сборки автоматически склеивает клип в N секунд через `loopVideoTo`.

### TypeScript setup

- `tsconfig.base.json` — `target: ESNext`, `moduleResolution: Bundler`, `strict`, `skipLibCheck`, `types: ["bun"]`
- `packages/lib/tsconfig.json`, `packages/toasts/tsconfig.json` — наследуют base, `noEmit: true`; у toasts — `paths` для `@xtc-toaster/lib`
- `@types/bun@1.4.0` + `typescript@7.0.2` в devDependencies
- `npm run typecheck` → `tsc -p packages/lib/tsconfig.json && tsc -p packages/toasts/tsconfig.json`

### Финальный рендер

Входной файл: `degas-076.jpg` (2000×1966).  
Параметры анимации: 36 кадров, 36fps (1 секунда клип).  
Итоговый файл: `sqnc_1788105588930_degas_2k_x1.5_15s.mp4` — ускорен в 1.5× через `setpts=PTS/1.5`, зациклен до 15 секунд.

Текущий стек слоёв (финальная версия сессии):

```
darkGray #a4a4a4 (фон)
+ blurred original (blur 0.48% width, opacity 0.8)
+ lightGray #ebebeb (opacity 0.6)
+ blue #00ffdd (lch-hue, opacity 0.8)
+ purple (value mask 16±0.32, tint #FF00FF, blur 0.24%, opacity 0.6, perspective -0.2t, translate 2t)
+ red    (value mask 12±0.24, tint #FF0000, blur 0.10%, opacity 0.8, perspective -0.1t, translate 1t)
+ white  (value mask 92±0.16, tint #FFFFFF,             opacity 1.0, perspective -0.05t, translate 1t)
```

## Остаток

- Маска `valueMask` — рассмотреть замену квадратичного спада на Гауссов (`exp(-t²/0.5)`)
- `CanvasRenderer` для браузерного вывода — техдолг
- Превью в терминале не работает внутри Zellij (см. `docs/backlog/2026-08-30_zellij-kitty-graphics-protocol.md`)
- Интеграция libvips напрямую через `bun:ffi` — см. `docs/backlog/2026-08-30_sharp-libvips-integration.md`
