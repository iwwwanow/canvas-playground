# CLI Usage

```bash
# Из корня проекта (рекомендуется)
pnpm toast <command>

# Или напрямую
npx tsx packages/cli/src/index.ts <command>
```

---

## Команды

### `toast list`
Список всех доступных тостов.
```bash
npx tsx src/index.ts list
```

---

### `toast run <slug>`
Применить тост к одному изображению.

```bash
npx tsx src/index.ts run <slug> -i <input> -o <output> [--param key=value ...]
```

**Параметры:**
- `-i, --input` — входной файл (jpg, png, webp, ...)
- `-o, --output` — выходной файл
- `--param key=value` — параметр тоста (повторяется)

**Примеры:**
```bash
# hue-noise: вырезать срез по оттенку + шум (прозрачный фон)
npx tsx src/index.ts run hue-noise -i input.png -o out.png --param hue=180

# hue-scan: срез + шум на белом фоне (composition-6)
npx tsx src/index.ts run hue-scan -i input.png -o out.png --param hue=90 --param noizeDeviation=0.5

# hue-scan: другой фон
npx tsx src/index.ts run hue-scan -i input.png -o out.png --param hue=45 --param background=#000000

# hue-scan: с минимальным шумом
npx tsx src/index.ts run hue-scan -i input.png -o out.png --param hue=200 --param noizeDeviation=0.1
```

---

### `toast batch <slug>`
Применить тост к папке с изображениями или списку файлов.

```bash
npx tsx src/index.ts batch <slug> -i <dir|list.txt> -o <output-dir> [--param key=value ...]
```

**Параметры:**
- `-i, --input` — папка с изображениями или `.txt` файл со списком путей (по одному на строку)
- `-o, --output` — выходная папка (создаётся автоматически)
- `--param key=value` — параметр тоста (повторяется)

**Примеры:**
```bash
# Обработать папку
npx tsx src/index.ts batch hue-scan -i ./photos/ -o ./results/ --param hue=90

# Обработать список файлов
npx tsx src/index.ts batch hue-scan -i files.txt -o ./results/ --param hue=180 --param noizeDeviation=0.2

# files.txt:
# /home/user/img1.jpg
# /home/user/img2.png
# ./photos/img3.webp
```

---

### `toast publish`
Опубликовать тост на сервере.

```bash
npx tsx src/index.ts publish -n <name> -p <preview.gif> [-d <description>]
```

---

### `toast login`
Авторизация.

```bash
npx tsx src/index.ts login <username> <password>
```

---

## Тосты

| Slug | Параметры | Выход |
|---|---|---|
| `hue-noise` | `hue` (0–359), `noizeDeviation` (0–1) | PNG (прозрачный фон) |
| `hue-scan` | `hue` (0–359), `noizeDeviation` (0–1), `background` (#hex) | PNG (на цветном фоне) |
| `hue-cycle` | `hueStart` (0), `hueEnd` (359), `hueStep` (1), `noizeDeviation` (0.3), `background` (#fff), `fps` (30), `format` (mp4\|gif) | MP4 или GIF |

---

## Тестовые команды

> Все команды из корня проекта.
> Рекомендуемый тестовый файл: `input-256.jpg` (256px wide, быстрее рендерится).

```bash
# Создать уменьшенную копию для тестов
ffmpeg -i input.jpg -vf scale=256:-1 input-256.jpg -y

# hue-scan: один кадр, разные оттенки
pnpm toast run hue-scan -i input-256.jpg -o out-hue0.png --param hue=0
pnpm toast run hue-scan -i input-256.jpg -o out-hue90.png --param hue=90
pnpm toast run hue-scan -i input-256.jpg -o out-hue180.png --param hue=180

# hue-scan: чёрный фон, без шума
pnpm toast run hue-scan -i input-256.jpg -o out-black.png --param hue=45 --param background=#000000
pnpm toast run hue-scan -i input-256.jpg -o out-clean.png --param hue=120 --param noizeDeviation=0

# hue-noise: прозрачный фон
pnpm toast run hue-noise -i input-256.jpg -o out-noise.png --param hue=180

# hue-cycle: полная анимация → MP4
pnpm toast run hue-cycle -i input-256.jpg -o out-cycle.mp4 --param hueStep=5

# hue-cycle: GIF, 15fps
pnpm toast run hue-cycle -i input-256.jpg -o out-cycle.gif --param hueStep=5 --param format=gif --param fps=15

# hue-cycle: только часть диапазона
pnpm toast run hue-cycle -i input-256.jpg -o out-red.mp4 --param hueStart=330 --param hueEnd=360 --param hueStep=1

# batch: обработать папку
pnpm toast batch hue-scan -i assets/ -o batch-out/ --param hue=90
```
