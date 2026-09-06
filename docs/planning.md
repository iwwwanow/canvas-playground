# Планирование

## DDD-lite → Zig+Skia перенос domain-части (`packages/lib`)

Полный контекст решений: `docs/diary/2026-08-28_ddd-lite-go-ffi-planning.md`, `docs/diary/2026-08-29_domain-spec-review.md`, `docs/diary/2026-08-29_domain-ts-implementation.md`, `docs/diary/2026-08-31_render-stack-architecture-decision.md`. Спека — `docs/specs/domain.spec.ts`. Финальная архитектура — `docs/backlog/2026-08-31_final-render-export-stack-architecture.md` (отменяет более ранний план на libvips, `docs/backlog/2026-08-30_sharp-libvips-integration.md`).

- [x] 1. Довести `docs/specs/domain.spec.ts` до состояния "готово к реализации"
- [x] 2. Ревью спецификации, подбить детали
- [x] 3. Написать домен на TS в `packages/lib/domain/` (Color, utils, domain-services, Layer, Composition) с unit-тестами на composers/maskers/transform — фикстуры переиспользуются как golden-values для Zig-порта
- [ ] 4. Перенос домена — **не 1:1 порт всего в Zig**, а разделение: пиксельный низкий уровень (blur, affine/perspective resample, normal/add blend) → **Skia**; оркестрация (Layer/Composition) и уникальная математика без готового Skia-аналога (HSV-маска с falloff, hue-noise, lch-hue compose, решение гомографии по 4 точкам) → **Zig**. Полная инвентаризация по платформам — `docs/diary/2026-08-31_render-stack-architecture-decision.md`
  - [ ] 4a. Спецификация нужных методов Skia + FFI-ручек Bun, с юз-кейсами (готовит пользователь руками)
  - [ ] 4b. Схемы границ Bun/Zig/Skia/ffmpeg
  - [ ] 4c. Рефакторинг текущей структуры `packages/lib/domain/services/` под новую архитектуру — делать **до** переноса, не одновременно
  - [ ] 4d. Профилировать и убрать per-pixel аллокации `Matrix` в `transforms.ts` (`applyAffineTransform`/`applyHomographyTransform`) — вероятная причина ~8.3 сек/кадр на рендере от 2026-08-30; актуально до переноса, снимется архитектурно после (Zig не аллоцирует так в hot path)
- [ ] 5. Биндинг-слой (`packages/lib/infrastructure/ffi/*.binding.ts`, handle-паттерн, contract-test на рассинхрон сигнатур) — граница Bun↔Zig; список экспортируемых функций — там же в диневнике
- [ ] 6. Bun-инфра (dev-loop через `watchexec`, package setup для `lib-native` — Zig-пакет вне npm-воркспейса, собирается в `.so`/`.dylib`)
- [ ] 7. TS-класс `Toast` в `packages/lib/application/` — единая точка управления: импорт/экспорт/анимация/рендер статики. Заменяет более ранний план "переписать тосты под `bake(layer, ...)`"
- [ ] 8. Инициализировать `package.json` для `packages/lib` + настроить GitHub Actions на сборку npm-пакета — низкий приоритет, делать последним (после того как есть что собирать)

### Реальный техдолг (не блокирует перенос)

- [ ] Вынести `CanvasRenderer` отдельно от `Composition` — легаси мешает DOM/canvas-код с доменной логикой
- [ ] `animation.spec.ts` / `segmentation.spec.ts` — не проработаны, следующая итерация (mosaic-segment вне скоупа)
- [ ] `valueMask` — рассмотреть замену квадратичного спада на Гауссов (`exp(-t²/0.5)`)
- [ ] Превью в терминале не работает внутри Zellij — `docs/backlog/2026-08-30_zellij-kitty-graphics-protocol.md`
- [ ] Заменить `node-canvas` (decode/encode изображений) на Skia (`SkCodec`/encoders через Zig) — решено 2026-09-06, не заводим вторую нативную зависимость на ту же задачу. `imageFileToRawData`/`rawDataToImageFile` переезжают в `lib-native` вместе с остальным Skia-путём
