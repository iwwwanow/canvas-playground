# 2026-08-31 — запечь toast-1: константы рендера, seamless loop

Сессия по доводке `packages/toasts/src/toasts/toast-1_degas/index.ts` до состояния "одна команда — готовый файл". Параллельно фиксили баги в `packages/lib/infrastructure/assemble-gif.ts`.

## Что сделали

### 1. Захардкодили все параметры рендера

Убрали все CLI-аргументы кроме `-i` (путь к картинке). Всё остальное — константы в коде:

```ts
const SCALE = 1.0;
const FPS = 36;
const FRAMES = 24;
const TARGET_DURATION = 15;
```

Запуск: `pnpm toast-1` (дефолтная картинка `assets/degas-076.jpg`), опционально `-i path/to/image.jpg`.

### 2. Путь к результату

- Промежуточные файлы (raw mp4, кадры) → `/tmp/` (mkdtemp)
- Итог → `./baked-toasts/degas_YYYYMMDD-HHmmss_<input-stem>.mp4`
- `baked-toasts/` добавлен в `.gitignore`

### 3. Разобрались с параметрами оригинала

Эталон: `sqnc_1788105588930_degas_2k_x1.5_15s.mp4` (30.2 MB).
Нашли оригинальные файлы в `tmp/outputs/sqnc_1788105588930_degas_2k*`.

Ffprobe показал:
- Raw клип: **36fps, 1.0s, 36 кадров** — значит рендер шёл на FPS=36, а не 24
- Итоговый x1.5 файл: 36fps, 15s, 540 кадров

Вся дорогая отладка крутилась вокруг fps/frames путаницы между тремя коммитами:
- `9728b2f`: `frameCount:36, fps:24` (неправильный fps)
- `2bd979e`: `DEFAULT_FRAMES=24, DEFAULT_FPS=24` (правильный fps, но другие кадры)
- реальный эталон: рендер делался вручную с fps=36

### 4. Итоговый флоу

```
24 кадра при 36fps → 0.667s клип → loopVideoTo (23 цикла × 0.667s = 15.33s)
```

Без speedUpVideo — скорость бекается в fps (36 vs 24 baseline = 1.5x быстрее).

### 5. Seamless loop

Проблема: `t = i / (FRAMES - 1)` — последний кадр t=1.0 ≠ первый t=0.0, рывок при луп-переходе.

Фикс: `t = i / FRAMES` — последний кадр t=(FRAMES-1)/FRAMES, шаг к следующему циклу такой же как между всеми остальными кадрами.

Целое число циклов:
```ts
const clipDuration = FRAMES / FPS;                       // 0.667s
const cycles = Math.round(TARGET_DURATION / clipDuration); // 23
const exactDuration = cycles * clipDuration;               // 15.33s
```

`loopVideoTo` использует `-stream_loop -1 -t exactDuration` → ровно 23 полных цикла, никакого обрыва.

### 6. Фиксы в lib

- `loopVideoTo`: добавили `-t targetSeconds` для точного обрезания
- `speedUpVideo`: пока оставили в либе (не удаляли), но в toast-1 не используется
- `assembleVideo`: вернули к стандартному fps (убрали speed-параметр, который добавляли и откатили)

## Подводные камни

- `setpts=PTS/1.5` без явного `-r` на выходе даёт непредсказуемый дроп кадров и неверную длительность (18 кадров вместо 24 из 36-кадрового клипа). Не использовать для управления скоростью — управлять через fps рендера.
- Файловый размер зависит от blur: `0.8` → меньше (более compressible), `0.48` → больше. Оригинал использовал `0.48` на `blurred`-слое.
- `git tag` — достаточно для фиксации состояния. npm publish для `packages/toasts` не нужен (скрипт, не либа). GitHub Packages поддерживает npm-реестр, но требует auth даже для чтения.

## Текущие константы toast-1

| Параметр | Значение |
|---|---|
| SCALE | 1.0 |
| FPS | 36 |
| FRAMES | 24 |
| TARGET_DURATION | 15s |
| cycles | 23 (≈15.33s) |
| blur (blurred layer) | 0.48 |
| blur (purple layer) | 0.24 |
| blur (red layer) | 0.1 |

## Остаток

- Визуально сравнить новый seamless вариант с эталоном (скорость, контент)
- Второй тост (mosaic) — следующий в очереди по `docs/planning.md`
- Технический долг из предыдущей сессии без изменений (Matrix аллокации, CanvasRenderer, valueMask Гауссов спад)
