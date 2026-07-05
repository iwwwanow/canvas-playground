<script lang="ts">
  import { toasts } from "@xtc-toaster/core";
  import { toastStore } from "../../stores/toast.store.svelte";
  import ToastCard from "./ToastCard.svelte";

  const toastList = Object.values(toasts);
</script>

<div class="gallery">
  <div class="toolbar">
    <span class="title">Toasts</span>
  </div>
  <div class="grid">
    {#each toastList as toast (toast.meta.slug)}
      <ToastCard
        {toast}
        selected={toastStore.selectedSlug === toast.meta.slug}
        onclick={() => toastStore.setSlug(toast.meta.slug)}
      />
    {/each}
  </div>
</div>

<style>
  .gallery {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: 28px 1fr;
    background: var(--color-bg);
    overflow: hidden;
  }
  .toolbar {
    display: flex;
    align-items: center;
    padding: 0 8px;
    background: var(--color-header);
    border-bottom: 1px solid var(--color-border);
  }
  .title {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .grid {
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-content: flex-start;
  }
</style>
