# 2026-08-30 — toast-1: CLI, инфраструктура, первый рендер

Первая сессия на ветке `feat/toast-1`. Подняли пакет `toasts`, подключили `lib` как workspace-зависимость, написали CLI и получили первый рендер (hue-маска).

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

## Остаток

- Сама композиция toast-1 пока тривиальна (один слой, фиксированный hue=0) — нужно развивать
- Нет флага `--output` в CLI
- Нет флага для hue/tolerance из командной строки
- `CanvasRenderer` для браузерного вывода — техдолг, не трогали
- Шаг 4 (Zig) и шаг 8 (npm-пакет) из прошлых сессий — без изменений
