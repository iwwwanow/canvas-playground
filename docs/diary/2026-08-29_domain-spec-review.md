# 2026-08-29 — ревью и добивка `docs/specs/domain.spec.ts`

Продолжение вчерашней сессии (`docs/diary/2026-08-28_ddd-lite-go-ffi-planning.md`) — начертили черновик домена (`docs/specs/domain.spec.ts`, коммит `387e607`) с вопросами-комментариями по коду, прошлись по нему вместе, довели до состояния "готово к реализации" (коммит `5358fb5`, "working variant done").

## Что разобрали и решили

- **Точка входа в домен** — `Composition.createLayerFromPixelData()` / `createBlankLayer()` / `createColorLayer()` / `duplicateLayer()`, все возвращают `Layer`. `Layer` никогда не создаётся напрямую в use-case-коде. `createColorLayer` = `createBlankLayer()` + `layer.fill(color)`, отдельной "colors"-категории сервисов не нужно.
- **Layer — eager, не lazy.** Три приватных кандидата (`applyEffects/renderLayer/render`) из черновика убраны целиком: причина, по которой в легаси `transform` откладывался до `Composition.render()` — Layer не знал `width/height`. Решили передавать их в конструктор Layer как отдельный **`LayerDimensions`** value object (неизменяемый, без сеттеров — в отличие от `LayerOptions`, у которого есть `setBlendMode/setOpacity/setTransform`). После этого `setTransform` применяется сразу, как `mask()`/`applyEffect()` — никакой очереди операций, никакого промежуточного состояния. Побочный эффект: `Composition.render()` в реализации упростится — не нужен отдельный шаг "getTransformedLayers", трансформация уже отражена в `imageData` к моменту рендера.
- **`Pixel` слит в `Color`.** Один value object вместо двух: `Color` — канонический конструктор от `RgbaPixel`, статик-фабрики `fromHex/fromRgb/fromUintArray` (последняя заменяет `Pixel.getDataFromUintArray`), геттеры `.normalized` (0-1, **с alpha** — `RgbaNormalizedPixel`) и `.hex`. Геттеры, не методы — обосновали правилом: геттер, когда результат это просто другое представление того же значения без побочных эффектов/параметров.
- **`Transform`/`MaskParams`/`EffectParams` — discriminated union по `name`, не `{name, value: number}`.** Плоская форма не влезала: `scale`/`skew` нужны два числа, `channel` — enum, не число. Взяли за образец уже существующий в легаси `TransformParams`.
- **`cutChannel` — не маска, разводим с `cutHue/Saturation/Value`.** У масок (`mask()`) RGB не трогается, alpha = вес совпадения — их честно можно класть в `alphaCompose`. `cutChannel` (→ `isolateChannel()`) ведёт себя иначе: выкидывает RGB под цвет-индикатор канала, значение канала прячет в alpha. Решили не подгонять поведение под общий контракт (не "чинить" cutChannel) — оставить как отдельную функцию с отдельным именем, не объединять под одним `cut()`.
- **`mergeLayerData` переписан под примитивы** (`dataLength, bgData, fgData, fgBlendMode`) — это был единственный domain-service во всём core, нарушавший правило "только примитивы, никогда Layer/Composition". Opacity больше не читается изнутри редьюсера — должна быть уже запечена в alpha-канал до вызова (ответственность оркестрации, Composition/Layer).
- **`duplicateLayer` — explicit deep copy.** Обсудили отдельно: `Uint8ClampedArray` — reference-тип, "просто скопировать imageData" неоднозначно (ссылка vs новый буфер). Сейчас shallow-копия технически безопасна, потому что все операции переприсваивают `imageData` новым массивом, а не мутируют по индексам — но это неявный инвариант, который легко сломать будущей оптимизацией (избегание лишних аллокаций на видео/батче — то, ради чего вообще затевается Go/Zig-переезд). Зафиксировали явно: `duplicateLayer` всегда аллоцирует новый буфер, результат никогда не делит память с источником.
- **Финальная категоризация services/utils**, зафиксирована прямо в файле:
  - domain-services (только из методов Layer/Composition): maskers (`hsvMask/hueMask/saturationMask/valueMask`), `isolateChannel`, composers (`alphaCompose/addCompose`), effects (`addHueNoise`), transforms (`applyAffineTransform/applyYRotationPerspective`), reducer (`mergeLayerData`).
  - utils (domain-agnostic, ничего не знают о Layer/Composition/Color, лежат уровнем ниже services): math (`Matrix, alphaComposing`), color-space-utils (`hexToRgb/hexToRgba/rgbToHsl/hslToRgb/rgbToHsv/getChannelIndex`).
- Попутно поправили россыпь мелких багов в черновике: тьюпл-баги (`[Layer]`, `[RgbPixel]` вместо `Layer[]`/`RgbPixel`), `Uint8Array`→`Uint8ClampedArray`, `BlendMode` placeholder→`"normal"|"add"`, опциональные поля `LayerOptions`, опечатка `LayerOptoins`, осиротевший дубль `setTransform()`.

## Осознанно не трогали

- **`docs/specs/animation.spec.ts`** — новый набросок (keyframe/timeline модель, кривые Безье). Явно отложено пользователем ("сырой вайбкод, не лезем туда покачто") — не анализировали, не связывали с существующим прототипом таймлайна в `legacy/packages/sandbox` (там уже есть рабочий bezier/F-curve редактор, но решили не смотреть на него сейчас).
- **`docs/specs/segmentation.spec.ts`** — заглушка на одну строку (перенесённый список mosaic-segment сервисов). Соответствует уже принятому решению "mosaic-segment вне скоупа, следующей итерацией" — закрывать тут пока нечего.
- Дискутировали, не перенести ли содержимое `domain.spec.ts` в `.md` — решили оставить `.ts`: это буквально заготовка сигнатур для `packages/lib/domain`, и discriminated union'ы работают как проверяемая типами структура, а не просто текст. Рациональное "почему" по-прежнему в дневнике/бэклоге, не дублируется в спеке.

## Остаток

- Реальный техдолг из вчерашней сессии всё ещё открыт: `Composition` в легаси смешивает DOM/canvas-код с доменной логикой — вынести в `CanvasRenderer` при реализации на TS.
- `animation.spec.ts` и `segmentation.spec.ts` — не проработаны, ждут своей итерации.
- Домен считается готовым к реализации на TS — план в `docs/diary/2026-08-28_ddd-lite-go-ffi-planning.md` (шаги 1-2 закрыты, следующий — шаг 3).
