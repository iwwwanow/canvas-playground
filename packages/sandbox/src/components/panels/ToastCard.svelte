<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { Toast } from "@xtc-toaster/core";

  let {
    toast,
    selected = false,
    onclick,
  }: { toast: Toast; selected?: boolean; onclick?: () => void } = $props();

  let canvas: HTMLCanvasElement;
  let frameId: number;

  onMount(() => {
    const size = 100;
    const img = new Image();
    img.src = "/poppy-3.webp";
    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      const original = new Uint8ClampedArray(
        ctx.getImageData(0, 0, size, size).data,
      );
      let hue = 0;
      const animate = () => {
        const result = toast.bake(original, size, size, { hue });
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(result), size, size),
          0,
          0,
        );
        hue = (hue + 1) % 360;
        frameId = requestAnimationFrame(animate);
      };
      frameId = requestAnimationFrame(animate);
    };
  });

  onDestroy(() => cancelAnimationFrame(frameId));
</script>

<button class="card" class:selected {onclick}>
  <canvas bind:this={canvas} class="preview"></canvas>
  <div class="info">
    <span class="name">{toast.meta.name}</span>
    {#if toast.meta.description}
      <span class="desc">{toast.meta.description}</span>
    {/if}
  </div>
</button>

<style>
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-radius: 6px;
    background: var(--color-header);
    border: 1px solid var(--color-border);
    cursor: pointer;
    user-select: none;
    transition: border-color 0.15s;
  }
  .card:hover { border-color: var(--color-accent); }
  .card.selected { border-color: var(--color-accent); background: var(--color-canvas-bg); }
  .preview { width: 100px; height: 100px; image-rendering: pixelated; }
  .info { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .name { font-size: 11px; font-weight: 600; color: var(--color-text); }
  .desc { font-size: 10px; color: var(--color-text-dim); text-align: center; }
</style>
