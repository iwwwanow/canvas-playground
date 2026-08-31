# Планирование

## DDD-lite → Go/Zig перенос domain-части (`packages/lib`)

Полный контекст решений: `docs/diary/2026-08-28_ddd-lite-go-ffi-planning.md`, `docs/diary/2026-08-29_domain-spec-review.md`, `docs/diary/2026-08-29_domain-ts-implementation.md`. Спека — `docs/specs/domain.spec.ts`.

- [x] 1. Довести `docs/specs/domain.spec.ts` до состояния "готово к реализации"
- [x] 2. Ревью спецификации, подбить детали
- [x] 3. Написать домен на TS в `packages/lib/domain/` (Color, utils, domain-services, Layer, Composition) с unit-тестами на composers/maskers/transform — фикстуры переиспользуются как golden-values для Zig-порта
- [ ] 4. Переписать домен на Zig (1:1 порт) — **язык подтверждён: Zig** (закрыто 2026-08-29). Разделение труда (уточнено 2026-08-30): **одну самую изолированную функцию + её FFI-биндинг пишет пользователь руками** — обкатать паттерн `Zig-функция → build.zig → FFI → bun test сверяет golden-values` (см. `docs/diary/2026-08-30_zig-port-approach-and-toast.md`); как только паттерн зафиксирован — **остальной 1:1 порт делает агент**. Стратегия памяти для ручной части — `docs/backlog/2026-08-30_zig-engine-memory-strategy.md`
- [ ] 5. Биндинг-слой (`bindings/*.binding.ts`, handle-паттерн, contract-test на рассинхрон сигнатур)
- [ ] 6. Bun-инфра (dev-loop через `watchexec`, package setup для zig-bun-биндингов)
- [ ] 7. Переписать тосты (`legacy/packages/core/lib/toasts/`) под `bake(layer: Layer, ...)` в `packages/lib/application/`, протестировать сквозно на новом тосте
- [ ] 8. Инициализировать `package.json` для `packages/lib` + настроить GitHub Actions на сборку npm-пакета — низкий приоритет, делать последним (после того как есть что собирать)

### Реальный техдолг (не блокирует Go/Zig-перенос)

- [ ] Вынести `CanvasRenderer` отдельно от `Composition` — легаси мешает DOM/canvas-код с доменной логикой
- [ ] `animation.spec.ts` / `segmentation.spec.ts` — не проработаны, следующая итерация (mosaic-segment вне скоупа)

### Функциональные пробелы domain-слоя (gap-анализ 2026-08-30)

Аудит текущего состояния `domain/services/` — не блокирует Zig-порт, но задаёт следующий слой работы после него. **Весь новый функционал (в отличие от 1:1-порта) пользователь пишет на Zig руками сам** — учебная цель важнее скорости, агенту не отдаётся.

- [ ] Composers: только `alpha` (Porter-Duff over) и `add` — добавить multiply/screen/overlay/darken/lighten/difference и т.д. (дёшево, паттерн уже есть в `composers.ts`)
- [ ] Effects: только `addHueNoise` — нет convolution/kernel-примитива, а без него нет blur/sharpen/edge-detect. Главный пробел, писать руками (это и есть цель проекта)
- [ ] Maskers: HSV-маски и channel isolation есть, нет маски по произвольному вектору/пути — точка интеграции с paper.js (рендер вектора → alpha-маска), подробности — `docs/backlog/2026-08-30_vector-3d-data-model-primitives.md`
- [ ] Transforms: affine только forward-mapping (дырки, известный баг), нет обратного маппинга и интерполяции (nearest/bilinear/bicubic) при resize
- [ ] I/O: декода/энкода форматов (PNG/JPEG) независимо от браузерного Canvas нет — `infrastructure/` пуст. Нужно под server-side/npm-пакет цель, кандидат — `sharp` как infrastructure-адаптер
- [ ] Вектор: буллевы операции над путями — кандидаты `clipper-lib`/`martinez-polygon-clipping`, подробности — `docs/backlog/2026-08-30_boolean-path-ops-clipper.md`
