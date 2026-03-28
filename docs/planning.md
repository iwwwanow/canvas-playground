# Planning

## Концепция

Сборник заскриптованных фильтров и генераторов графики.
- Каждый фильтр / генератор называется **toast**
- Запечь тост = отрендерить
- Тост принимает изображение + параметры, возвращает изображение **или видео**

---

## Пакеты (монорепо)

| Пакет | Язык | Роль |
|---|---|---|
| `core` | TypeScript | Pixel-processing: Layer, Composition, Cutters, Toasts |
| `sandbox` | Svelte 5 + Vite | Dev-среда: редактор тостов, превью, таймлайн |
| `cli` | Node.js | Запуск тостов, батч-обработка, публикация |
| `api` | Node.js + Hono | REST API для хранения и просмотра тостов |
| `web` | Go | Публичный просмотр тостов, прогон своих изображений |

Стили web-пакета: https://github.com/iwwwanow/owo (встраиваем напрямую, без ui-kit).

---

## Интерфейс Toast

```ts
export type ToastOutput =
  | { type: 'image'; data: Uint8ClampedArray }
  | { type: 'video'; path: string }

export type BakeFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params?: Record<string, unknown>,
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

---

## Тосты

### Toast 1: `hue-scan` ✅
Вырезает срез по оттенку, добавляет хромашум, рендерит на цветной фон.

Параметры: `hue` (0–359), `noizeDeviation` (0–1), `background` (#hex)

### Toast 2: `mosaic` ✅ (в разработке — рендер готов)
Мозаичная замена регионов видео на медиафайлы. Многошаговый пайплайн.

**Алгоритм сегментации:**
1. Каждый пиксель → HSV → квантование (tones × hues)
2. BFS → связные компоненты одного цвет-класса
3. PCA на координатах пикселей → ориентированный прямоугольник (центр, угол, размер)
4. Прямоугольники пересчитываются per-frame → эффект дребезжания

**Пайплайн:**
```
mosaic frames   -i video.mp4 -o ./frames/   → per-frame сегментация + превью
mosaic collect-assets -o ./assets/          → скачать ассеты (Pexels API)
mosaic render   --segments ./frames/segments.json --assets ./assets/ -o result.gif
```

**Параметры сегментации:**
- `tones` — уровни тона (Value), default 6
- `hues` — уровни оттенка (Hue), default 6
- `minRegionSize` — мин. пикселей в пятне, default 200
- `gap` — отступ между прямоугольниками в px, default 4

**Лучшие найденные параметры:** tones=12, hues=12, min-region=8 (максимальная дробность)

**Параметры рендера:**
- `--mode photo|solid` — фото-ассеты или плоский цвет
- `--tint-tiles` — overlay-тинт цветом сегмента; `--tint-strength 0–1`
- `--gradient-map` — дуотон: тёмные пиксели → цвет сегмента, светлые → белый
- `--hue-tiles` — заменяет оттенок фото на оттенок сегмента (★ best)
- `--blur-tiles` — размытие тайлов пропорционально их размеру
- `--boost-tiles` / `--boost-strength` — контрастный буст светлых тайлов
- `--max-tile N` — делит сегмент на ячейки N×N, каждая получает свой ассет по тону

**Пресеты** (см. `presets.json`):
- `hue-photo` ★ — `--mode photo --hue-tiles`
- `tint-photo` — `--mode photo --tint-tiles --tint-strength 0.5`
- `gradient-map` — `--mode photo --gradient-map`
- `solid-color` — `--mode solid`

**outputType:** `video`

---

## Приоритеты

### Фаза 1 — CLI-first ✅
- [x] Toast-интерфейс: outputType, BakeFn → Promise<ToastOutput>
- [x] hue-scan тост
- [x] runCommand, toast batch
- [x] mosaic: сегментация (постеризация + PCA + заливка цветом)
- [x] mosaic: collect-assets (Pexels API)
- [x] mosaic: render (ассеты → видео, per-frame segments, ротация тайлов)
- [x] mosaic frames: per-frame сегментация (дребезжание прямоугольников)
- [x] mosaic render: photo режим с ассетами (index.json кэш)
- [x] mosaic render: tint-tiles, gradient-map, hue-tiles, blur-tiles, boost-tiles
- [x] mosaic render: --max-tile (grid subdivision, per-cell tone-matched assets)
- [x] mosaic render: streaming ffmpeg pipe, concurrency limiter

### Фаза 1.5 — Шоурил / Качество
- [ ] **P1** GIF с дизерингом — palettegen+paletteuse в ffmpeg pipeline
- [ ] **P2** `--scale` параметр рендера — уменьшить выход до N px по ширине
- [ ] **P3** mosaic segment для статичных изображений → цикличный GIF
- [ ] **P4** seed для воспроизводимых рендеров

### Фаза 2 — Sandbox/GUI
- [ ] Подключить timeline к viewport
- [ ] CodeMirror для bake-функции
- [ ] "Сохранить как тост"

### Фаза 3 — Инфраструктура
- [ ] API (Hono) + SQLite
- [ ] Web (Go)
- [ ] Docker compose + GitHub Actions

### Toast 3: `motion-mosaic` 🔜

**Концепция:** мозаика, управляемая движением — скорость смены ассетов и размер тайлов привязаны к optical flow между кадрами.

---

### Фаза 5 — Beat-synced content factory
- [ ] Beat extractor (aubio CLI)
- [ ] Frame scheduler по таймкодам
- [ ] ffmpeg compositor с аудио

---

## Технические заметки

- ffmpeg — системная зависимость (ubuntu noble 6.1.1)
- CLI запускать через `npx tsx src/index.ts`
- Ассеты: 11826 фото+видео в `assets/downloaded/` (flowers, sky, ocean-waves, abstract-texture, forest, sunset)
- Pexels API key в `.env` как `PEXELS_API_KEY`
- Тестовые файлы писать в `batch-out/`
- Оптимизация сегментации: сегментировать на 160×90, масштабировать сегменты × (W/160, H/90)

## Структура batch-out/

```
batch-out/
  timelapse/
    clips/        ← mosaic-clip00-05-color.mp4
    segments/     ← mosaic-clip00-05-seg/
    story/        ← story-mosaic-v1.mp4
  new-inputs/
    segments/     ← input-01/, input-02/, input-03/ + fine/ultra variants
    renders/      ← гифки по all presets
  _archive/       ← старые тесты
```
