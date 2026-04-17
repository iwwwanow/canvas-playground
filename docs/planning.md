# Planning

## Концепция

Сборник заскриптованных фильтров и генераторов графики.
- Каждый фильтр / генератор называется **toast**
- Запечь тост = отрендерить
- Тост принимает изображение или видео + параметры, возвращает изображение **или видео**

---

## Пакеты (монорепо)

| Пакет | Язык | Роль |
|---|---|---|
| `core` | TypeScript | Pixel-processing: Layer, Composition, Cutters, Toasts |
| `sandbox` | Svelte 5 + Vite | Dev-среда: редактор тостов, превью, таймлайн |
| `cli` | Node.js | Запуск тостов, батч-обработка, публикация |
| `api` | Node.js + Hono | REST API для хранения и просмотра тостов |
| `web` | Go | Публичный просмотр тостов, прогон своих изображений |

Запуск из корня (pnpm workspaces):
```bash
pnpm sandbox   # Svelte dev server → localhost:5173/editor.html
pnpm api       # Hono API
pnpm web       # Go web
pnpm toast     # CLI (= npx tsx packages/cli/src/index.ts)
```

Стили web-пакета: https://github.com/iwwwanow/owo (встраиваем напрямую, без ui-kit).

---

## Интерфейс Toast

Текущий (в `packages/core/lib/toasts/index.ts`):

```ts
export type ToastOutput =
  | { type: 'image'; data: Uint8ClampedArray }
  | { type: 'video'; path: string }

export type BakeFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params?: Record<string, unknown>,
  outputPath?: string,
  onProgress?: ProgressFn,
) => ToastOutput | Promise<ToastOutput>

export interface Toast {
  meta: {
    slug: string
    name: string
    description?: string
    outputType: 'image' | 'video'
  }
  bake: BakeFn
}
```

Планируемые расширения:

```ts
// Добавить поле params для декларации UI-виджетов
export type ToastParam =
  | { type: 'range';   key: string; label: string; min: number; max: number; default: number; step?: number }
  | { type: 'color';   key: string; label: string; default: string }
  | { type: 'fcurve';  key: string; label: string; default: FCurveKeyframe[] }
  | { type: 'select';  key: string; label: string; options: string[]; default: string }
  | { type: 'boolean'; key: string; label: string; default: boolean }

// Добавить inputType для видео-тостов (speed-remap и т.п.)
meta: { ..., inputType?: 'image' | 'video' }
params?: ToastParam[]
```

---

## Тосты

### Toast 1: `hue-scan` ✅
Вырезает срез по оттенку, добавляет хромашум, рендерит на цветной фон.
Параметры: `hue` (0–359), `noizeDeviation` (0–1), `background` (#hex)

### Toast 2: `mosaic` ✅ (рендер готов)
Мозаичная замена регионов видео на медиафайлы. Многошаговый пайплайн.

**Алгоритм сегментации:**
1. Каждый пиксель → HSV → квантование (tones × hues)
2. BFS → связные компоненты одного цвет-класса
3. PCA на координатах пикселей → ориентированный прямоугольник
4. Прямоугольники пересчитываются per-frame → эффект дребезжания

**Пайплайн:**
```
mosaic frames   -i video.mp4 -o ./frames/
mosaic collect-assets -o ./assets/
mosaic render   --segments ./frames/segments.json --assets ./assets/ -o result.gif
```

**Параметры сегментации:** `tones` (def 6), `hues` (def 6), `minRegionSize` (def 200)
**Лучшие параметры:** tones=12, hues=12, min-region=8

**Пресеты** (см. `presets.json`):
- `hue-photo` ★ — `--mode photo --hue-tiles`
- `tint-photo` — `--mode photo --tint-tiles --tint-strength 0.5`
- `gradient-map` — `--mode photo --gradient-map`
- `solid-color` — `--mode solid`

**outputType:** `video`

### Toast 3: `speed-remap` 🔜
Ретайминг видео по кривой скорости (f-curve). inputType: `video`.

Параметры:
- Входное видео
- F-кривая скорости: X = выходное время (в кадрах), Y = скорость (1.0 = норм, 2.0 = 2x)

CLI уже работает:
```bash
pnpm toast speed-remap -i input.mp4 -o output.mp4 --curve "0:1,48:2,96:0.5"
pnpm toast speed-remap -i input.mp4 -o output.mp4 --curve speed-curve.json
```

SpeedRemapPanel.svelte для редактирования кривой в sandbox существует, но ещё не интегрирован как Toast.

### Toast 4: `motion-mosaic` 🔜
Мозаика, управляемая движением — скорость смены ассетов и размер тайлов привязаны к optical flow между кадрами.

---

## GUI — Node-based редактор тостов

### Концепция: Blender-style node editor

Редактор тостов — **нод-граф**, как shader editor в Blender.
Каждая нода — модуль с входами и выходами. Соединяешь ноды кабелями → данные текут между ними.

```
[Import: video/image] ──► [Timeline / F-Curve] ──► [Code Editor] ──► [Export]
                                                          ▲
                                               [Color Picker]  [Slider]
```

### Типы нод

| Нода | Выход | Описание |
|---|---|---|
| **Import** | `image \| video` | Загрузка файла (image или video) |
| **Timeline** | `keyframes`, `currentFrame`, `speed` | F-Curve редактор. Передаёт значения по кадрам |
| **Code Editor** | `result` | JS/TS код тоста. Входные ноды — переменные в коде |
| **Slider** | `number` | Числовой параметр с min/max/step |
| **Color** | `[r,g,b,a]` | Color picker |
| **Viewport** | — | Рендерит `result` от Code Editor вживую |
| **Export** | — | Сохраняет результат (png/mp4/gif), настраивается через GUI |

### Как данные текут между нодами

```js
// В Code Editor: подключённые ноды становятся переменными
const hue = timeline.keyframes.hue.value;  // значение кривой на текущем кадре
const frame = timeline.currentFrame;
const { data, width, height } = input;     // пиксели от Import-ноды
// ... обработка ...
return outputData;  // → в Viewport и Export
```

### Дизайн — Figma макет 1920×1080

Референс: `.claude/pages/desktop.html`

Панели:
- **Левая (801×616)** — Viewport (canvas + "Bake toast" / "Save as toast")
- **Центр (801×616)** — Code Editor (syntax highlighting)
- **Правая (190px)**:
  - Верх — Layers (список слоёв, × и +)
  - Низ — Properties (Hue/Sat/Val inputs + Transform)
- **Нижняя полоса (1856×80)** — Timeline controls (frame counter, play/pause/stop)
- **Timeline ruler (1634×288)** — F-Curve / scrubber

Дизайн-система:
- Font: **Roboto Condensed** (14px labels, 28px заголовки)
- Accent: **#ff115c** (hot pink)
- Text: **#535353**, Inputs: **#e0e0e0**

### Стратегия реализации

**Фаза 1** — фиксированный макет по desktop.html. Панели жёстко расставлены, данные между ними передаются через нод-систему в памяти (без визуального графа).

**Фаза 2** — визуальный нод-граф на холсте (пользователь сам соединяет ноды).

### Текущее состояние GUI (апрель 2026)

- `editor.html` → App.svelte: gallery + viewport работает
- 4 image-тоста: hue-noise, hue-scan, hue-cycle, mosaic-segment — превью вживую ✅
- Параметров нет — `params` не добавлены, панель параметров не построена
- SpeedRemapPanel.svelte (f-curve редактор) существует, не интегрирован как тост
- FCurvePanel.svelte существует, используется только в демо-режиме

### Чеклист GUI

- [ ] Фиксированный макет по desktop.html (Viewport + Code Editor + Properties + Timeline)
- [ ] Архитектура нод-данных между панелями (в памяти)
- [ ] Import нода (image/video)
- [ ] Timeline нода (FCurvePanel.svelte уже есть)
- [ ] Code Editor нода (Monaco или CodeMirror)
- [ ] Viewport нода (canvas)
- [ ] Export нода
- [ ] Layers panel
- [ ] Properties panel (динамические виджеты по `toast.params`)
- [ ] Хэш-роутинг: `#/` галерея, `#/toast/:slug` редактор
- [ ] Добавить `params` к существующим тостам (hue-scan, mosaic)
- [ ] Интегрировать speed-remap как Toast (inputType=video, fcurve-параметр)
- [ ] Визуальный нод-граф на холсте (фаза 2)

---

## Приоритеты

### Фаза 1 — CLI-first ✅
- [x] Toast-интерфейс: outputType, BakeFn → Promise<ToastOutput>
- [x] hue-scan тост
- [x] runCommand, toast batch
- [x] mosaic: сегментация, collect-assets, render (photo/solid, все эффекты)
- [x] mosaic frames: per-frame сегментация
- [x] mosaic render: streaming ffmpeg pipe, concurrency limiter, index.json кэш
- [x] speed-remap: CLI команда (f-curve → ffmpeg concat)

### Фаза 1.5 — Качество / Шоурил
- [ ] **P1** GIF с дизерингом — palettegen+paletteuse
- [ ] **P2** `--scale` параметр рендера
- [ ] **P3** mosaic segment для статики → цикличный GIF
- [ ] **P4** seed для воспроизводимых рендеров

### Фаза 2 — GUI (Node editor)
- [ ] Фиксированный макет по desktop.html
- [ ] `params` на Toast-интерфейсе + динамические виджеты
- [ ] Интеграция speed-remap как Toast в GUI
- [ ] Code Editor (CodeMirror) + передача переменных из нод

### Фаза 3 — Инфраструктура
- [ ] API (Hono) + SQLite
- [ ] Web (Go)
- [ ] Docker compose + GitHub Actions

### Фаза 4 — Beat-synced content factory
- [ ] Beat extractor (aubio CLI)
- [ ] Frame scheduler по таймкодам
- [ ] ffmpeg compositor с аудио

---

## Клипы: нарезка + mondrian-отбор

```bash
./scripts/split-batch.sh          # нарезать batch-out/inputs → batch-out/clips/
./scripts/mondrian-clip-batch.sh  # mondrian по клипам → batch-out/clips-mondrian/
```

Параметры нарезки: случайная 1–5 сек, max 540px, libx264 crf 23.

Параметры mondrian:
```
mosaic frames: --fps 15 --tones 12 --hues 12 --min-region 32
mosaic render: --mode solid --color-palette D40920,1B3F8B,F5C000 --bg-color FFFFFF
               --scale 540 --fps 15 --format mp4 --no-save-frames
```

### Статус
- [ ] Нарезать все видео из batch-out/inputs
- [ ] Прогнать mondrian по клипам
- [ ] Отобрать лучший материал
- [ ] Смонтировать рил

---

## Reels: mondrian-рендер всех видео

Выход: `batch-out/reels/mondrian-renders/mondrian-v{N}.mp4`

Референс: `batch-out/new-inputs/renders/test8-mondrian-mr32-t12-h12.gif`
Тесты: `batch-out/reels/mondrian-test/TEST-LOG.md`

| видео | длина | статус |
|-------|-------|--------|
| video-1.mp4 | 774s | ✅ готов — тёмный, не подходит |
| video-3.mp4 | 393s | 🔄 |
| video-4.mp4 | 1949s | 🔄 |
| video-5.mp4 | 127s | 🔄 |
| video-6.mp4 | 4130s | 🔄 |
| video-7.mp4 | 286s | 🔄 |
| video-8.mp4 | 148s | 🔄 |
| video-9.mp4 | 2267s | 🔄 |

Mondrian v2 (отложено): разделение по движению — крупные формы для фона, мелкие там где движение.

---

## video-1: смонтированный cut

`batch-out/reels/cut-v2.mp4` — 58 сек, 1080×1920, blur-фон + оригинал по центру.

| # | Источник | Длит. | Роль |
|---|---|---|---|
| 1 | 1:30–1:33 | 3с | intro flash |
| 2–6 | 7:30–9:36 | 5×6с | основной блок |
| 7–9 | 10:00–10:50 | 3×5с | сочный блок |
| 10 | 12:44–12:54 | 10с | финал |

---

## Презентация mosaic-тоста

Цель: набор GIF-превьюшек по всем режимам.

Сегменты готовы в `batch-out/new-inputs/segments/`.

Фичи для демонстрации: `--mode solid/photo`, `--tint-tiles`, `--gradient-map`, `--hue-tiles`, `--blur-tiles`, `--boost-tiles`, `--max-tile 64`.

Проблема со статикой: 1 фрейм сегментов → flickering без направленного движения. Решение TBD.

- [ ] Решить вопрос со статикой
- [ ] Прогнать render-demo.sh для video-инпутов
- [ ] Подготовить финальный набор GIF

---

## Технические заметки

- ffmpeg — системная зависимость (ubuntu noble 6.1.1)
- Тестовые файлы писать в `batch-out/`
- Ассеты: `assets/downloaded/` — фото+видео (flowers, sky, ocean-waves, abstract-texture, forest, sunset)
- Pexels API key в `.env` как `PEXELS_API_KEY`
- Оптимизация сегментации: сегментировать на 160×90, масштабировать сегменты × (W/160, H/90)
- Слабая машина: предпочитать sequential + concurrency limit вместо параллельных sharp/ffmpeg

## Структура batch-out/

```
batch-out/
  clips/              ← нарезанные клипы
  clips-mondrian/     ← mondrian-рендеры клипов
  reels/
    mondrian-renders/ ← финальные рендеры
    mondrian-test/    ← тесты + TEST-LOG.md
    cut-v2.mp4        ← смонтированный cut video-1
  new-inputs/
    segments/         ← input-01/, input-02/, input-03/
    renders/          ← гифки по пресетам
  _archive/           ← старые тесты
```
