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
Мозаичная замена регионов изображения на медиафайлы. Многошаговый пайплайн.

**Параметры:**
- `segmentationLevel` — 0–1, детализация разбиения (default 0.5)
- `assetsDir` — путь к папке с ассетами (видео/gif/изображения)
- `duration` — длина итогового видео в секундах (default 10)

**CLI (три шага или один):**
```bash
# Шаг 1: разбить изображение на прямоугольники и визуализировать
toast mosaic segment -i input.jpg -o ./output/ --segmentation-level 0.5

# Шаг 2: собрать и аннотировать ассеты (один раз)
toast mosaic collect-assets --count 100 --output-dir ./assets/

# Шаг 3: рендеринг видео
toast mosaic render --rectangles ./output/rectangles.json --assets ./assets/ -o result.mp4

# Или всё за один вызов
toast run mosaic -i input.jpg -o result.mp4 --param segmentationLevel=0.5 --param assetsDir=./assets/
```

**outputType:** `video`

---

## CLI команды (итог)

```bash
toast run <slug> -i <input> -o <output> [--param key=value ...]
toast batch <slug> -i <dir|list.txt> -o <dir> [--param key=value ...]
toast render -s <script.ts> -i <input> -o <output.mp4>   # скрипт → видео (будущее)
toast mosaic segment|collect-assets|render [opts]
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

### Фаза 1 — CLI-first (текущий фокус)
- [ ] **1.1** Расширить Toast-интерфейс: добавить `outputType`, обновить `BakeFn` → `Promise<ToastOutput>`
- [ ] **1.2** Создать `hue-scan` тост (composition-6 → toast)
- [ ] **1.3** Обновить `runCommand` под новый интерфейс (image vs video output)
- [ ] **1.4** Добавить `toast batch` команду
- [ ] **1.5** Реализовать `mosaic` тост (segment → collect → render)

### Фаза 2 — Sandbox/GUI
- [ ] **2.1** Подключить timeline к viewport (треки управляют params)
- [ ] **2.2** Добавить CodeMirror панель для написания bake-функции
- [ ] **2.3** Кнопка "Сохранить как тост" → генерирует файл в `/lib/toasts/`

### Фаза 3 — Инфраструктура
- [ ] **3.1** API (Hono) + SQLite для хранения тостов
- [ ] **3.2** Web-интерфейс (Go) для просмотра и прогона
- [ ] **3.3** Docker compose для dev-режима
- [ ] **3.4** GitHub Actions для сборки и публикации образов

---

## Нерешённые вопросы (mosaic)

- API-ключи Pexels/Pixabay: хранить в env (`.env` + `toast config set PEXELS_API_KEY=xxx`)
- Алгоритм сегментации: bounding boxes поверх цветовых кластеров (k-means) — без opencv4nodejs, чистый TypeScript
- FFmpeg: обязательная системная зависимость для mosaic-тоста
