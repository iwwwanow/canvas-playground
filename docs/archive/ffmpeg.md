# ffmpeg

## Sequence → MP4

Файлы берутся из текущей директории.

### Numbered pattern (e.g. `name_%04d.png`)

```bash
ffmpeg -framerate 24 -i name_%04d.png -c:v libx264 -pix_fmt yuv420p output.mp4
```

### Glob (любые PNG в папке)

```bash
ffmpeg -framerate 24 -pattern_type glob -i '*.png' -c:v libx264 -pix_fmt yuv420p output.mp4
```

### Нечётные размеры (odd width/height)

libx264 требует чётные ширину и высоту. Если canvas имеет нечётный размер:

```bash
ffmpeg -framerate 24 -pattern_type glob -i '*.png' -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -pix_fmt yuv420p output.mp4
```

### Параметры

| флаг                                  | значение                              |
| ------------------------------------- | ------------------------------------- |
| `-framerate`                          | кадров в секунду (24, 30, 60)         |
| `-c:v libx264`                        | кодек H.264                           |
| `-pix_fmt yuv420p`                    | совместимость с QuickTime / браузером |
| `-vf "pad=ceil(iw/2)*2:ceil(ih/2)*2"` | округление до чётных размеров         |
