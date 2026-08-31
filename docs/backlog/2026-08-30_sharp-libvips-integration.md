# Интеграция libvips напрямую через C-биндинги

Sharp не нужен — у него своя логика поверх libvips, которая пересекается с нашей lib и создаёт лишний слой. Правильнее писать биндинги к libvips (или другой C-либе) самим через `bun:ffi` напрямую.

Разделение остаётся тем же: C-либа берёт низкоуровневые пиксельные операции (blur, геометрика, базовый composite), наш lib — оркестратор пайплайна слоёв со всей специфичной логикой (HSV-маски, lch-hue blend, hue noise, reducer). Обмен данными тривиален — libvips работает с плоским RGBA-буфером, 1:1 наш `Uint8ClampedArray`.

Открытый вопрос — архитектура границы между тремя рантаймами: **Bun** (хост), **Zig** (планируемый порт hot-path), **C** (libvips). Bun поддерживает FFI к C нативно (`bun:ffi`), Zig компилируется в C-ABI — так что все три стыкуются через единый C-интерфейс. Нужно проработать эту границу прежде чем начинать.

## Разбор: что конкретно тащим из libvips, что остаётся своим

Прошёлся по текущему `packages/lib/domain/services/*` и сопоставил с API libvips.

**Забирает libvips напрямую (готовые C-вызовы, свой код выкидывается):**
- `boxBlur` (effects.ts, ручной two-pass) → `vips_boxblur`/`vips_gaussblur`
- `alphaCompose`/`addCompose` (composers.ts) → `vips_composite2(bg, fg, mode)` — у vips вообще весь набор Photoshop/SVG blend-мод встроен из коробки, не только over/add. Для стека из N слоёв со стандартными модами есть множественная форма `vips_composite`, схлопывающая весь reducer за один вызов
- `isolateChannel` (maskers.ts) → `vips_extract_band` + `vips_bandjoin_const`
- `applyAffineTransform` (transforms.ts) → `vips_affine`. Бонус: наш вариант forward-mapped и потому дырявый (см. комментарий в коде про "holes"), vips — backward-mapped, дыр не будет в принципе
- `applyHomographyTransform` (углы/corner-pin, добавили вчера) → `vips_perspective(matrix)`. vips сам гомографию по 4 точкам не решает — матрицу нужно подавать готовую
- `applyYRotationPerspective` — параметризован через (angle, focalLength), но математически тот же класс преобразования (проекция повёрнутой плоскости — тоже гомография). Можно свести к генерации 3×3-матрицы и тоже прогнать через `vips_perspective`

**Остаётся своим (у libvips нет готового вызова, только кубики под композицию — либо принципиально не его слой):**
- `hsvMask`/`hueMask`/`saturationMask`/`valueMask` (maskers.ts) — полоса по HSV-компоненту с квадратичным затуханием и circular wrap для hue. У vips нет единой операции под это, только `colourspace(HSV)` + `relational_const` + арифметика как примитивы
- `addHueNoise` (effects.ts) — у vips вообще нет HSL как colourspace (только HSV и LCh). Нужен либо переезд на LCh-hue-noise, либо HSL руками
- `lchHueCompose` (composers.ts, hue из FG + L/C из BG) — не входит в стандартный enum blend-мод vips
- `homographyFromPairs`/`gaussianElimination` (transforms.ts) — решение системы по 4 точкам → матрица. Это чистая линейная алгебра, не image processing, vips её не делает
- **Доменная модель слоёв целиком** (`Layer`: opacity→alpha bake, порядок, привязка эффектов к слою) — оркестрация, не pixel-processing функция. У C-либы её в принципе быть не может, остаётся на нас/Zig независимо от того, что умеет vips

**Вес**: сам libvips — 30.87 MiB (installed size), обязательные C-зависимости (cfitsio, fftw, libexif, libarchive, libimagequant, librsvg, libwebp, openexr, highway, pango, libcgif, cairo, lcms2, openjpeg2) — ещё ≈46 MiB. Опциональные форматные модули (heif/imagemagick/openslide/poppler/jxl) — ещё ≈49 MiB, но для нашего пайплайна (RGBA-буфер, blur/geometry/composite) не нужны, можно смело выкидывать из сборки.

**Решение**: прежде чем переносить — сначала рефакторинг текущего кода (структура уже поменялась после `chore(packages): refactor structure init`, домен переехал в `packages/lib/domain/services/`). План переноса — отдельно, после рефакторинга.
