<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { toasts } from "@xtc-toaster/core";
  import { toastStore } from "../../stores/toast.store.svelte";

  const CANVAS_ID = "__gui_canvas__";

  let canvas: HTMLCanvasElement;
  let imageSize = $state<{ w: number; h: number } | null>(null);
  let originalData = $state<Uint8ClampedArray | null>(null);
  let animFrameId: number | null = null;

  function stopAnim() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function loadImage(img: HTMLImageElement) {
    stopAnim();
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    imageSize = { w, h };
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    originalData = new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
  }

  function onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = document.getElementById("__gui_img__") as HTMLImageElement;
    img.onload = () => loadImage(img);
    img.src = url;
  }

  onMount(() => {
    const img = document.getElementById("__gui_img__") as HTMLImageElement;
    if (img.complete && img.naturalWidth > 0) loadImage(img);
    else img.onload = () => loadImage(img);
  });

  onDestroy(stopAnim);

  $effect(() => {
    const slug = toastStore.selectedSlug;
    stopAnim();
    if (!slug || !originalData || !canvas || !imageSize) return;

    const toast = toasts[slug];
    if (!toast) return;

    const ctx = canvas.getContext("2d")!;
    const { w, h } = imageSize;
    const data = originalData;
    let hue = 0;

    const loop = () => {
      const result = toast.bake(data, w, h, { hue });
      ctx.putImageData(new ImageData(new Uint8ClampedArray(result), w, h), 0, 0);
      hue = (hue + 1) % 360;
      animFrameId = requestAnimationFrame(loop);
    };
    animFrameId = requestAnimationFrame(loop);

    return stopAnim;
  });
</script>

<img id="__gui_img__" src="/poppy-3.webp" alt="" style="display:none" />

<div class="viewport">
  <div class="toolbar">
    <span class="title">Viewport</span>
    <label class="btn">
      Load image
      <input type="file" accept="image/*" onchange={onFileChange} hidden />
    </label>
    {#if imageSize}
      <span class="info">{imageSize.w} × {imageSize.h} px</span>
    {/if}
    {#if toastStore.selectedSlug}
      <span class="info">— {toasts[toastStore.selectedSlug]?.meta.name}</span>
    {/if}
  </div>

  <div class="canvas-area">
    <canvas id={CANVAS_ID} bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .viewport {
    width: 100%; height: 100%;
    display: grid; grid-template-rows: 28px 1fr;
    background: var(--color-canvas-bg);
  }
  .toolbar {
    display: flex; align-items: center; gap: 8px;
    padding: 0 8px;
    background: var(--color-header);
    border-bottom: 1px solid var(--color-border);
  }
  .title { font-size: 11px; font-weight: 600; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: .05em; }
  .btn {
    font-size: 11px; color: var(--color-text);
    background: var(--color-border); padding: 2px 8px;
    border-radius: 3px; cursor: pointer; user-select: none;
  }
  .btn:hover { background: var(--color-accent); }
  .info { font-size: 11px; color: var(--color-text-dim); }

  .canvas-area {
    position: relative; overflow: auto;
    display: flex; align-items: center; justify-content: center;
  }
  canvas { image-rendering: pixelated; max-width: 100%; max-height: 100%; }
</style>
