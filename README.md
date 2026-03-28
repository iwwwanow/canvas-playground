<p align="center">
  <img src="assets/logo/logo-color.png" alt="xtc toaster" width="220" />
</p>

# xtc toaster

Canvas-based image processing toolkit. Apply parametric pixel effects — **toasts** — to images and video via CLI or browser sandbox.

Zero production dependencies. Native Canvas and ImageData APIs only.

---

## Packages

| Package | Description |
|---|---|
| `packages/core` | Toast library — effects, cutters, composers, color utils |
| `packages/cli` | CLI — run, batch, list, publish, login |
| `packages/sandbox` | Browser GUI — Svelte 5 + Vite, live preview |
| `packages/api` | REST API — Hono + SQLite |

---

## Quick Start

```bash
pnpm install
pnpm toast list
```

```bash
# Apply a toast to an image
pnpm toast run hue-scan -i photo.jpg -o out.png --param hue=180

# Process a folder
pnpm toast batch hue-scan -i ./photos/ -o ./results/ --param hue=90

# Render animation
pnpm toast run hue-cycle -i photo.jpg -o out.mp4
```

---

## Toasts

| Slug | Output | Key params |
|---|---|---|
| `hue-noise` | PNG (transparent) | `hue` 0–359, `noizeDeviation` 0–1 |
| `hue-scan` | PNG | `hue`, `noizeDeviation`, `background` (#hex) |
| `hue-cycle` | MP4 / GIF | `channels[]`, `fps`, `format` |
| `mosaic` | MP4 | `tones`, `hues`, `minRegionSize` |

---

## Mosaic Pipeline

```bash
# 1. Extract per-frame segments
pnpm toast mosaic frames -i input.mp4 -o batch-out/frames/ --tones 6 --hues 6

# 2. Download tile assets
pnpm toast mosaic collect-assets -o assets/downloaded --count 24

# 3. Render
pnpm toast mosaic render --segments batch-out/frames/ --assets assets/downloaded -o result.mp4
```

---

## Sandbox (GUI)

```bash
cd packages/sandbox
pnpm dev
```

Live canvas preview — load an image, pick a toast, scrub the timeline.

---

## CLI Reference

Full docs: [`docs/cli.md`](docs/cli.md)

```
toast list
toast run <slug> -i <input> -o <output> [--param key=value ...]
toast batch <slug> -i <dir> -o <output-dir> [--param key=value ...]
toast publish -n <name> -p <preview.gif>
toast login <username> <password>
```

---

## Architecture

```
Source image → ImageData (Uint8ClampedArray, RGBA)
    ↓
Cutters  — extract pixels by hue / saturation / value / channel
    ↓
Layers   — wrap pixel data + blend mode + opacity + effects
    ↓
Reducer  — merge layers pairwise via Composer
    ↓
Composition — orchestrates pipeline, owns canvas
```

Colors are normalized to `0–1` internally, `0–255` in storage.

---

## Requirements

- Node.js 20+
- pnpm
- ffmpeg (for video output)
