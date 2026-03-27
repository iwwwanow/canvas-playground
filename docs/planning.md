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
// Выходной тип
export type ToastOutput =
  | { type: 'image'; data: Uint8ClampedArray }
  | { type: 'video'; path: string }

// Функция рендера
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
    outputType: 'image' | 'video'   // новое поле
  }
  bake: BakeFn
}
```

---

## Тосты

### Toast 1: `hue-scan`
На базе composition-6. Вырезает срез по оттенку, добавляет хромашум, рендерит на цветной фон.

**Параметры:**
- `hue` — 0–359, оттенок среза (default 0)
- `noizeDeviation` — 0–1, интенсивность шума (default 0.3)
- `background` — hex-цвет фона (default `#ffffff`)

**CLI:**
```bash
toast run hue-scan -i input.jpg -o output.jpg --param hue=180 --param background=#000000
toast batch hue-scan -i ./photos/ -o ./results/ --param hue=90
```

**outputType:** `image`

---

### Toast 2: `mosaic`
Мозаичная замена регионов **видео** на медиафайлы (изображения, видео, gif). Многошаговый пайплайн.

**Концепция (финал, 2026-03-27):**

**Этап 1 — Постеризация (тон + оттенок)**
- Каждый пиксель → HSV → квантование: N уровней Value × M уровней Hue
- Результат: дискретные цветовые пятна (≤ N×M классов + серые)

**Этап 2 — Прямоугольники по форме пятна**
- Для каждой связной области: PCA позиций пикселей → главная ось
- Один прямоугольник на пятно, ориентированный по главной оси
- Размер адаптивный (по охвату пятна), max aspect ratio 7:1
- Допустимый выход за границу пятна: до 8%

**⚠️ КРИТИЧНЫЙ НЕРЕАЛИЗОВАННЫЙ МОМЕНТ:**
Сегментация **должна пересчитываться для каждого кадра видео**.
Тогда прямоугольники будут «дрожать/дребезжать» — следовать за движением в видео.
Сейчас: сегментация вычисляется один раз (кадр 0) и кешируется → все кадры одинаковые.
→ Нужно убрать кеш в `mosaicFramesCommand`, считать `segment()` per-frame.
→ Для производительности: рассмотреть даунскейл кадра перед сегментацией (напр. до 160×90),
  а потом масштабировать сегменты обратно на оригинальный размер.

**Пайплайн:**
```
инпут-видео
  → [mosaic frames]  per-frame постеризация → прямоугольники → секвенция превью (дребезжание!)
  → [mosaic collect-assets]  скачать ассеты
  → [mosaic render]  per-frame: заменить прямоугольники на ассеты → склеить видео
```

**CLI:**
```bash
toast mosaic frames -i input.mp4 -o ./frames/ --tones 6 --hues 6
toast mosaic collect-assets -o ./assets/ --count 24
toast mosaic render --segments-dir ./frames/ --assets ./assets/ -o result.mp4 --duration 10
```

**Параметры сегментации:**
- `tones` — уровни тона (Value), default 6. Меньше = крупнее пятна
- `hues` — уровни оттенка (Hue), default 6. Меньше = крупнее пятна
- `minRegionSize` — мин. пикселей в пятне (шумофильтр), default 200

**Параметры рендера:**
- `--segments` — путь к segments.json
- `--assets` — папка с ассетами (jpg/png/mp4/gif/субпапки с PNG-секвенциями)
- `--duration` — длина выходного видео в секундах (default 5)
- `--fps` — кадров в секунду (default 24)

**outputType:** `video`

---

## CLI команды (итог)

```bash
toast run <slug> -i <input> -o <output> [--param key=value ...]
toast batch <slug> -i <dir|list.txt> -o <dir> [--param key=value ...]
toast render -s <script.ts> -i <input> -o <output.mp4>   # скрипт → видео (будущее)
toast mosaic frames -i <video> -o <dir> [--tones 6] [--hues 6]   # per-frame сегментация → дребезжание
toast mosaic collect-assets -o <dir> [--count 24] [--query <tag>]
toast mosaic segment -i <image> -o <dir>                          # одиночное изображение
toast mosaic render --segments-dir <dir> --assets <dir> -o <mp4> [--duration 10]  # per-frame рендер
toast list
toast publish -n <name> -p <preview.gif> [-d <desc>]
toast login <login> <password>
```

---

## Sandbox (GUI)

Два режима использования:
1. **Создание тоста** — пишешь функцию в редакторе, видишь превью в реальном времени, сохраняешь как новый тост
2. **Применение тоста** — выбираешь тост из галереи, загружаешь изображение, экспортируешь результат

→ Детальный план интерфейса: `docs/dev/gui.md`

---

## Приоритеты (что делать сейчас)

### Фаза 1 — CLI-first
- [x] **1.1** Toast-интерфейс: outputType, BakeFn → Promise<ToastOutput>
- [x] **1.2** hue-scan тост
- [x] **1.3** runCommand (image / frames / video output)
- [x] **1.4** toast batch
- [x] **1.5a** mosaic: сегментация (постеризация + PCA прямоугольники)
- [x] **1.5b** mosaic: collect-assets (Lorem Picsum)
- [x] **1.5c** mosaic: render (ассеты → видео, ротация тайлов)
- [ ] **1.5d** 🔥 mosaic frames: **per-frame сегментация** (убрать кеш → дребезжание прямоугольников)
- [ ] **1.5e** mosaic render: **per-frame segments** (читать segments из директории, не одного файла)
- [ ] **1.5f** mosaic: производительность — даунскейл для сегментации (160×90), масштабирование назад

### Фаза 2 — Sandbox/GUI
- [ ] **2.1** Подключить timeline к viewport
- [ ] **2.2** CodeMirror для bake-функции
- [ ] **2.3** "Сохранить как тост"

### Фаза 3 — Инфраструктура
- [ ] **3.1** API (Hono) + SQLite
- [ ] **3.2** Web (Go)
- [ ] **3.3** Docker compose
- [ ] **3.4** GitHub Actions

---

## Технические заметки

- ffmpeg — обязательная системная зависимость (установлен: ubuntu noble 6.1.1)
- Ассеты: Lorem Picsum (без ключа). Будущее: Pexels/Pixabay через env (`PEXELS_API_KEY`)
- Сегментация per-frame медленная — оптимизация: сегментировать на 160×90, масштабировать сегменты × (W/160, H/90)
