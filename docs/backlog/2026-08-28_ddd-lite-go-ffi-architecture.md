# DDD-lite архитектура + вынос domain-части на Go (FFI)

## Инкапсуляция домена (JS-часть, `legacy/packages/core/lib`)

Не полноценный DDD (нет персистентности/инвариантов, чтобы оправдать repositories/domain events/bounded contexts) — только слоение domain/application/infrastructure + инкапсуляция:

- **Composition** — aggregate root. Единственная точка входа в домен для use-case. Создаёт и отдаёт `Layer` (`createLayerFromSource()`, `createColorLayer()`, `getLayer(id)`), проверяет инвариант при `addLayer()` (совпадение длины данных с `imageDataLength`).
- **Layer** — child entity, создаётся только через Composition, никогда `new Layer()` в use-case-коде напрямую. Мутируется через собственные методы (`cutHue()`, `addEffect()`...), которые внутри себя дёргают domain-services.
- **domain-services** (`cutters/composers/reducers/transforms/math`, `Pixel`) — чистые функции ниже сущностей. Никогда не принимают Layer/Composition параметром, только примитивы (`Uint8ClampedArray`, числа). Вызываются только изнутри entity-методов: single-entity сервисы (cutters) — из методов `Layer`, cross-entity сервисы (`mergedLayerReducer`, нужен доступ сразу к нескольким слоям) — из `Composition.render()`. Use-case их не видит.
- Граница инкапсуляции в TS — не access-модификаторы, а паблик barrel `lib/index.ts`: экспортировать только `Composition`/`Layer`/enums, не экспортировать cutters/composers/reducers/Pixel.
- **toasts/** = application/use-case layer, оркестрируют только Layer+Composition.

Реальный текущий долг (важнее самого разложения по DDD-папкам): `Composition` сейчас мешает DOM/canvas-код (infrastructure) с доменной логикой (`layers[]`, render pipeline) — вынести canvas/DOM в отдельный `CanvasRenderer`, оставить `Composition` чистой (без `document`/`HTMLCanvasElement`).

## План: domain (pixel-math) на Go, вызов из Bun через FFI

Мотивация: неочевидность работы с памятью в JS (reference vs copy) + желание практики с multi-lang инфраструктурой. Клиентская часть (canvas/DOM) исключена из объёма — либа задумана как чистый бэкенд, target-нагрузка — видео и пакетная обработка изображений (не разовая картинка), поэтому оптимизации ниже оправданы, а не преждевременны.

- **Связка**: Go (`buildmode=c-shared`) + `bun:ffi` (не `koffi`/Node — Bun даёт FFI из коробки). gRPC отклонён — оверхед сети не нужен для in-process вызова на одной машине.
- **Rust/Zig отклонены** осознанно: Rust не хочется учить, Zig избыточно низкоуровневый для этой задачи. Go выбран за баланс сложности/функционала. Открытый риск: GC-паузы Go могут не уложиться в фреймовый бюджет видео — не постулируется, а должно быть измерено бенчмарком (p99 латентность обработки кадра) до окончательного решения; если паузы реально срывают кадры — тогда осмысленный повод перейти на Zig.
- **Zero-copy**: `runtime.Pinner` (Go 1.21+, не `C.malloc`) — пинить обычный Go-слайс на время экспозиции в JS, `Unpin()` при следующем `Render()`/`Free()`. Контракт: возвращённый буфер валиден только до следующего вызова на этой composition — реализовать через consume-callback API (`renderInto(cb)`), не отдавать сырой `Uint8Array` наружу напрямую, чтобы не давать вызывающему коду держать ссылку дольше валидности.
- **Handle-паттерн**: Go-объекты не передаются в C ABI напрямую — реестр `map[uint64]*T` в Go, наружу отдаётся `uint64`-handle, методы принимают handle. `FinalizationRegistry` в JS как second-line defense от забытого `.free()` (не гарантия — колбэк может не выполниться).
- **Dev-loop**: один watcher, не связка air+bun-watch (`bun --watch`, вероятно, не отслеживает `dlopen`-нутый `.so` как зависимость модуля) — `watchexec -w . -e go,ts -- sh -c "go build -buildmode=c-shared -o libtoaster.so . && bun run index.ts"`. Полный рестарт процесса обязателен принципиально: cgo shared lib нельзя безопасно выгрузить/перезагрузить в живом процессе (ограничение Go-рантайма).
- **Биндинги** (`bindings/*.binding.ts`) — ручные, без AST-кодогена (overkill для ~10-15 экспортируемых функций). Синхронность Go-экспортов и TS-биндингов — через contract-test (вызывает каждую экспортированную функцию, ловит рассинхрон сигнатур сразу), не автоматизацией. Опционально позже, если рассинхрон реально начнёт происходить: тонкий парсер сгенерированного cgo `.h`-заголовка → плоская таблица `symbols` для `dlopen()` (не полный кодоген класса — класс остаётся ручным). Библиотека `bun-ffi-gen` существует, но заточена под `bun:cc`, не проверена на cgo-шном формате заголовка.
