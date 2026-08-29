# Планирование

## DDD-lite → Go/Zig перенос domain-части (`packages/lib`)

Полный контекст решений: `docs/diary/2026-08-28_ddd-lite-go-ffi-planning.md`, `docs/diary/2026-08-29_domain-spec-review.md`, `docs/diary/2026-08-29_domain-ts-implementation.md`. Спека — `docs/specs/domain.spec.ts`.

- [x] 1. Довести `docs/specs/domain.spec.ts` до состояния "готово к реализации"
- [x] 2. Ревью спецификации, подбить детали
- [x] 3. Написать домен на TS в `packages/lib/domain/` (Color, utils, domain-services, Layer, Composition) с unit-тестами на composers/maskers/transform — фикстуры переиспользуются как golden-values для Zig-порта
- [ ] 4. Переписать домен на Zig (1:1 порт) — **язык подтверждён: Zig** (закрыто 2026-08-29)
- [ ] 5. Биндинг-слой (`bindings/*.binding.ts`, handle-паттерн, contract-test на рассинхрон сигнатур)
- [ ] 6. Bun-инфра (dev-loop через `watchexec`, package setup для zig-bun-биндингов)
- [ ] 7. Переписать тосты (`legacy/packages/core/lib/toasts/`) под `bake(layer: Layer, ...)` в `packages/lib/application/`, протестировать сквозно на новом тосте
- [ ] 8. Инициализировать `package.json` для `packages/lib` + настроить GitHub Actions на сборку npm-пакета — низкий приоритет, делать последним (после того как есть что собирать)

### Реальный техдолг (не блокирует Go/Zig-перенос)

- [ ] Вынести `CanvasRenderer` отдельно от `Composition` — легаси мешает DOM/canvas-код с доменной логикой
- [ ] `animation.spec.ts` / `segmentation.spec.ts` — не проработаны, следующая итерация (mosaic-segment вне скоупа)
