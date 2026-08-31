# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run typecheck  # TypeScript type checking (no emit)
npm run build      # Type check + production build
npm run preview    # Preview production build
```

No test framework is set up. There are no linting tools configured.

## Architecture

A canvas-based image composition engine for pixel-level image processing. Being restructured on branch `refactor/lib` from a single legacy package into a DDD-lite domain library at `packages/lib/` — see `docs/planning.md` for the full port plan (TS domain done → Zig 1:1 port in progress → toasts ported last). The pre-refactor implementation still lives under `legacy/packages/core/lib/` and is being ported function-by-function, not deleted outright.

### Current structure (`packages/lib/`)

Rendering pipeline (source image → pixel subsets → layered composition → merged output) is implemented as pure functions over `ImageRawDataArray` (`Uint8ClampedArray`, 4 bytes/pixel RGBA):

- `domain/entities/` — `Color`, `Composition`, `Layer`
- `domain/services/` — `composers.ts` (blend modes: `alpha` Porter-Duff over, `add` additive), `effects.ts` (currently only `addHueNoise`), `maskers.ts` (HSV-proximity masking + channel isolation — this superseded the old `cutters/` naming), `reducer.ts` (merges layers pairwise via a composer), `transforms.ts` (affine transforms + one hardcoded Y-axis perspective)
- `domain/utils/` — `alpha-composing.ts`, `color-space.ts` (RGB↔HSL↔HSV), `matrix.ts`, `pixel-io.ts`
- `infrastructure/` — currently an empty stub. Intended home for adapters to external tools: planned Zig FFI bindings, and (per `docs/backlog/`) candidates like `sharp` for format decode/encode, `paper.js`/`clipper-lib` for vector geometry rasterized into a layer, OpenCV for individual filter primitives. Keep these as thin converter functions (byte-layout/channel-order translation), not wrapper classes — same flat-function style as `domain/services/*.ts`.
- `application/` — currently an empty stub. Intended home for toasts (use-cases) that combine domain services + infrastructure adapters per composition; legacy equivalent is `legacy/packages/core/lib/toasts/`.

New raster functionality (blend modes, convolution/blur, transform interpolation — see gap-analysis in `docs/planning.md`) is being hand-written in Zig by the maintainer as a deliberate learning exercise, not delegated to an agent; only the 1:1 port of existing TS domain code goes to an agent.

### Known Issues

- `add`-blending in `composers.ts` is order-dependent when 3+ layers stack, because each intermediate result is clamped to `Uint8ClampedArray` (0–255) per `reduce()` step rather than once at the end — `clamp(clamp(a+b)+c) ≠ clamp(clamp(b+c)+a)` on overflow. `alpha` (Porter-Duff over) being order-dependent is expected, not a bug. Diagnosed but not fixed — see `docs/diary/2026-08-30_zig-port-approach-and-toast.md`.
- `transforms.ts`'s `applyAffineTransform` uses forward-mapping — destination pixels with no mapped source pixel stay transparent (holes). Needs backward-mapping + interpolation. Legacy `mappers/transformed-layers.mapper.ts` not yet ported.
