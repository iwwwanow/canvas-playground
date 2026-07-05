<script lang="ts">
  import ViewportPanel from "./components/panels/ViewportPanel.svelte";
  import ToastGallery from "./components/panels/ToastGallery.svelte";
  import SpeedRemapPanel from "./components/panels/SpeedRemapPanel.svelte";

  type Mode = "toasts" | "speed-remap";
  let mode = $state<Mode>("toasts");

  let ratio = $state(0.65);
  let dragging = false;
  let root: HTMLDivElement;

  function onDividerDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDividerMove(e: PointerEvent) {
    if (!dragging) return;
    const rect = root.getBoundingClientRect();
    ratio = Math.min(0.85, Math.max(0.3, (e.clientX - rect.left) / rect.width));
  }
  function onDividerUp() { dragging = false; }
</script>

<div class="app" bind:this={root}>
  <div class="topbar">
    <button class="tab" class:active={mode === "toasts"}      onclick={() => mode = "toasts"}>Toasts</button>
    <button class="tab" class:active={mode === "speed-remap"} onclick={() => mode = "speed-remap"}>Speed Remap</button>
  </div>

  <div class="workspace">
    {#if mode === "toasts"}
      <div class="pane" style="width:{ratio * 100}%">
        <ViewportPanel />
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="divider"
        onpointerdown={onDividerDown}
        onpointermove={onDividerMove}
        onpointerup={onDividerUp}
      ></div>

      <div class="pane" style="flex:1; min-width:0">
        <ToastGallery />
      </div>
    {:else}
      <div class="pane" style="flex:1">
        <SpeedRemapPanel />
      </div>
    {/if}
  </div>
</div>

<style>
  .app {
    width: 100vw; height: 100vh;
    display: flex; flex-direction: column;
    overflow: hidden;
    background: var(--color-bg);
  }
  .topbar {
    display: flex; align-items: center;
    height: 28px; flex-shrink: 0;
    background: var(--color-header);
    border-bottom: 1px solid var(--color-border);
    padding: 0 8px; gap: 2px;
  }
  .tab {
    background: none; border: none;
    color: var(--color-text-dim); font-size: 11px; font-weight: 600;
    padding: 0 10px; height: 100%; cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .tab:hover { color: var(--color-text); }
  .tab.active { color: var(--color-text); border-bottom-color: var(--color-accent); }

  .workspace { flex: 1; display: flex; overflow: hidden; }
  .pane { height: 100%; overflow: hidden; }
  .divider {
    width: 4px; height: 100%; flex-shrink: 0;
    background: var(--color-border);
    cursor: col-resize;
    transition: background 0.15s;
  }
  .divider:hover { background: var(--color-accent); }
</style>
