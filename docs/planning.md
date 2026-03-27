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

### Toast 2: `mosaic` 🔜
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
mosaic render   --segments ./frames/segments.json --assets ./assets/ -o result.mp4
```

**Параметры:**
- `tones` — уровни тона (Value), default 6
- `hues` — уровни оттенка (Hue), default 6
- `minRegionSize` — мин. пикселей в пятне, default 200
- `gap` — отступ между прямоугольниками в px, default 4

**Лучшие найденные параметры:** tones=14, hues=14, min-region=6

**outputType:** `video`

---

## Приоритеты

### Фаза 1 — CLI-first ✅ почти готово
- [x] Toast-интерфейс: outputType, BakeFn → Promise<ToastOutput>
- [x] hue-scan тост
- [x] runCommand, toast batch
- [x] mosaic: сегментация (постеризация + PCA + заливка цветом на прозрачном фоне)
- [x] mosaic: collect-assets (Pexels API, скрипт scripts/download-pexels.sh)
- [x] mosaic: render (ассеты → видео, per-frame segments, ротация тайлов)
- [x] mosaic frames: per-frame сегментация (дребезжание прямоугольников)
- [ ] **1.5g** 🔥 mosaic render: первый рендер с реальными ассетами
  - Стратегия: disk-first, не грузим ассеты в RAM
  - Нейминг ассетов на диске → индексный JSON → рендер читает с диска по одному
  - `assets/downloaded/` → `assets/index.json` (slug, path, type, tags)
- [ ] **1.5f** mosaic: производительность — даунскейл для сегментации

### Фаза 1.5 — Производительность (ПРИОРИТЕТ: машина слабая, зависает)

- [ ] **P1** `mosaic render` — убрать `Promise.all` по сегментам: заменить на batched concurrency (4 одновременно)
  - Файл: `packages/cli/src/commands/mosaic.ts:277`
  - Сейчас: 100–500 sharp-операций параллельно на каждый кадр → OOM
  - Фикс: утилита `mapConcurrent(arr, limit, fn)`, лимит = 4
- [ ] **P2** `mosaic render` — не копить все кадры в RAM, стримить напрямую в ffmpeg
  - Файл: `packages/cli/src/commands/mosaic.ts:272` — `outputFrames[]` растёт до 1+ ГБ
  - Фикс: открыть ffmpeg через stdin-pipe, писать кадры по одному, закрыть → mp4
- [ ] **P3** `extract-asset-frames` — `Promise.all` на декодирование фреймов → batched
  - Файл: `packages/cli/src/lib/extract-asset-frames.ts:69,98`
  - Менее критично (ограничено maxFrames=8), но добавить лимит для единообразия

### Фаза 2 — Sandbox/GUI
- [ ] Подключить timeline к viewport
- [ ] CodeMirror для bake-функции
- [ ] "Сохранить как тост"

### Фаза 3 — Инфраструктура
- [ ] API (Hono) + SQLite
- [ ] Web (Go)
- [ ] Docker compose + GitHub Actions

### Фаза 5 — Beat-synced content factory
- [ ] **Beat extractor** — читает BPM и таймкоды из mp3/wav (aubio CLI: `aubio tempo`)
  - Выход: `beats.json` — массив таймкодов `[0.5, 1.0, 1.5, ...]`
- [ ] **Frame scheduler** — маппит сегменты тоста на таймкоды
  - Каждый бит → новый кадр; кадр держится до следующего бита
  - Выход: список `{ frame_path, duration_ms }`
- [ ] **ffmpeg compositor** — собирает sequence + audio в mp4
  - `concat demuxer` с `duration` на кадр → видеопоток
  - `-i music.mp3` → накладывает аудио
- [ ] Интеграция: `mosaic bake --music music.mp3 --assets ./assets/ -o result.mp4`

**Зависимости:** aubio CLI (`apt install aubio-tools`), ffmpeg (уже есть)

---

### Фаза 4 — Ассеты (низкий приоритет)
- [ ] Классическая и современная живопись (Wikimedia Commons: Category:Paintings)
- [ ] Вырезки из кино/клипов (archive.org, CC-licensed)

---

## Технические заметки

- ffmpeg — системная зависимость (ubuntu noble 6.1.1)
- CLI запускать через `npx tsx src/index.ts` (core не компилируется, только через bundler/tsx)
- Ассеты: 120 фото + 90 видео в `assets/downloaded/` (flowers, sky, ocean-waves, abstract-texture, forest, sunset)
- Pexels API key в `.env` как `PEXELS_API_KEY`
- Сторис-скрипт: `scripts/make-story.sh` → `batch-out/story-reel-v1.mp4`
- Тестовые файлы писать в `batch-out/`
- Оптимизация сегментации: сегментировать на 160×90, масштабировать сегменты × (W/160, H/90)
