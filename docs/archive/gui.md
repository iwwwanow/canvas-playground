# GUI Plan (DEFERRED — Фаза 2)

> Реализовать после завершения CLI-first фазы.

## Макет (1920×1080)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Viewport 801px]  │  [Script Editor 801px]  │  [Inspector 190px] │
│                    │                         │                     │
│  canvas: превью    │  function bake(         │  LAYERS             │
│  текущего кадра    │    data, w, h, params   │  mask layer    [x]  │
│                    │  ) {                    │  layer 1       [x]  │
│                    │    // твой код          │  +                  │
│                    │  }                      │  ~                  │
│                    │                         │  PARAMS             │
│                    │                         │  Hue        [180]   │
│                    │                         │  Deviation  [0.3]   │
│                    │                         │  Background [#fff]  │
├────────────────────┴─────────────────────────┴─────────────────────┤
│  [Timeline]                                                         │
│  ▶ ■  Frame [100]       hue ◆────────────────────────◆            │
│                         dev ◆────────◆                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Дизайн-система (из desktop.html)

- Фон: `white`
- Акцент/рамки: `#ff115c`
- Текст: `#535353`
- Label bg: `rgba(234,234,234,0.8)`
- Input bg: `#e0e0e0`
- Шрифт labels: `Roboto Condensed`, uppercase, 14px
- Шрифт кода: `JetBrains Mono`, 13px, 20px line-height
- Highlight строки: `#e9f5e6` (зелёная)
- Caret строки: `#fcfaed` (жёлтая)

## Панели

### Viewport (слева)
- Canvas рендер результата текущего кадра
- Drag-and-drop загрузка изображения
- Размеры изображения в углу

### Script Editor (центр)
- CodeMirror 6, TypeScript
- Редактирует `bake(data, w, h, params)` функцию
- Live-eval: каждый keystroke → перерисовывает viewport
- Кнопка "Save as toast" → записывает файл в `/lib/toasts/`

### Inspector (справа)
- Список слоёв в текущей композиции
- Параметры тоста (динамически из Toast.meta.params)
- При наличии таймлайна — значения интерполированы на текущем кадре

### Timeline (снизу)
- Треки = параметры тоста (один трек на параметр)
- Keyframes как алмазы
- Scrubber → текущий кадр → params → bake → viewport
- Play/Pause/Stop
- Экспорт: рендер всех кадров → видео через CLI

## Workflow: создание нового тоста

1. Открыть sandbox
2. Загрузить исходное изображение
3. Написать `bake()` в редакторе — видеть результат сразу
4. Выставить ключевые кадры в таймлайне
5. Нажать "Save as toast" → появляется в `toast list`
6. Запустить из CLI: `toast run my-toast -i photo.jpg -o out.jpg`
