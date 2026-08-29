# 2026-08-29 — реализация домена на TS (шаг 3)

Продолжение сессии `docs/diary/2026-08-29_domain-spec-review.md` — спека (`docs/specs/domain.spec.ts`) готова, начали реализацию в `packages/lib/domain/`.

## Структура

```
packages/lib/
  domain/
    types.ts               — Channel, BlendMode, Transform/MaskParams/EffectParams, LayerDimensions/LayerOptions, ...
    utils/                 — matrix, alpha-composing, color-space (hexToRgb/rgbToHsl/rgbToHsv/...), pixel-io (internal)
    services/               — maskers, composers, reducer, effects, transforms — только примитивы, вызываются только из Layer/Composition
    entities/               — Color, Layer, Composition
    index.ts                — публичная поверхность домена
  application/index.ts      — заглушка, под тосты (шаг 7)
  infrastructure/index.ts   — заглушка, под zig-bun-биндинги (шаги 5-6)
  main.ts                   — точка входа пакета, реэкспортирует domain/index.ts
```

`domain/utils/pixel-io.ts` — не из спеки: маленький внутренний хелпер (`readPixel`/`readNormalizedPixel`, аналог легаси `Pixel.getDataFromUintArray`), нужен domain-services для чтения байт без обращения к `Color` (правило "services не знают о Color"). Не в публичном барреле.

Портировано 1:1 с `legacy/packages/core/lib/` (composers/alpha,add; cutters→maskers; math/matrix,alpha-composing; utils/color-space; transforms/y-rotation), кроме:
- **affine-трансформ** (`applyAffineTransform`) — оставлен forward-mapping (как в легаси, с "дырами" на границах — это отдельный известный техдолг, не чиним тут), но переписан на primitives-сигнатуру спеки (`data, dimensions: LayerDimensions, transform: Transform`) вместо класса `Transformation`.
- **`mergeLayerData`** — по ревью спеки уже не читает opacity, ждёт запечённую в alpha (см. вчерашний дневник); `Composition.render()` теперь сам печёт opacity в alpha перед вызовом редьюсера (`bakeOpacity`).

## Решения по ходу реализации (спека их не покрывала дословно)

- **`Composition.createLayerFromPixelData/createBlankLayer/createColorLayer/duplicateLayer` сами пушат созданный `Layer` во внутренний массив и возвращают его.** Уточнение (было непонятно из чата): `addLayer(layer)` — метод из **легаси** (`legacy/packages/core/lib/classes/composition.class.ts:71`), в новом коде такого метода нет и не было. Когда спеку дописывали, `addLayer` из неё выпал, а замены не появилось — без явной регистрации созданный `Layer` был бы вообще не частью композиции. Закрыли тем, что create*-методы сами регистрируют результат.
- **`Layer.imageData` / `Layer.options` — публичные геттеры**, хотя в спеке поля объявлены `private`. Нужны `Composition.render()`/`duplicateLayer()` для чтения буфера/опций другого объекта — TS `private` class-scoped, не file-scoped, спека сама неявно это предполагает (комментарий `new Uint8ClampedArray(layer.imageData)` в `duplicateLayer`).
- **`Layer` экспортируется из пакета только как тип** (`export type { Layer }`), не как класс-значение — снаружи нельзя `new Layer(...)`, только получить экземпляр через `Composition` и типизировать переменную/параметр функции (пригодится для будущих тостов `bake(layer: Layer, ...)`). `Composition` и `Color` экспортируются как значения (`Color` нужен для `createColorLayer(color)`).
- **Экспорт пакета** (`main.ts`) — реэкспортирует `domain/index.ts` целиком; `domain-services`/`utils` туда не попадают (только из методов Layer/Composition, как и написано в спеке).

## Структура packages/lib — вопрос пользователя "нужен ли application?"

Да, нужен — но пустой до шага 7. Это будущий слой тостов (use-case), которые переживут переезд домена на Zig почти без изменений в самой логике, только сигнатура входа меняется на `bake(layer: Layer, ...)`. `infrastructure/` аналогично пустой — под будущие zig-bun-биндинги.

## Тесты

`bun test packages/lib` — 58 тестов, все проходят (utils: matrix/alpha-composing/color-space; services: maskers/composers/reducer/transforms; entities: Color/Layer/Composition). `applyEffect(noize)` тестируется только с `deviationCoefficient: 0` (детерминированно) — с ненулевым шумом тест был бы про случайность, не про поведение.

Полный `tsc --noEmit` не гонялся — нет ещё `package.json`/`tsconfig.json` для `packages/lib` (см. planning.md, шаг 8, намеренно отложен пользователем). Проверено через `bun test` (транспиляция без типов) и ручной smoke-run через `bun run`.

## Остаток

- Шаг 4: перенос на Zig (язык подтверждён финально пользователем в этой сессии, план уже это фиксировал с 08-28)
- Шаг 8 (package.json + GitHub Actions на сборку npm-пакета) — добавлено в planning.md, низкий приоритет
- `CanvasRenderer` — всё ещё отдельный техдолг, не трогали
