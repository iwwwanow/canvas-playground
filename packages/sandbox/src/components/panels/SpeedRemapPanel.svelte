<script lang="ts">
  import { onMount } from "svelte";

  // ── Types ──────────────────────────────────────────────────────────────────

  interface Vec2 { x: number; y: number; }

  interface Kf {
    id: string;
    frame: number;
    value: number;
    handleIn: Vec2;
    handleOut: Vec2;
    mode: "auto" | "free";
  }

  // ── Bezier (mirrors lib/bezier.ts) ────────────────────────────────────────

  function cubic(t: number, p0: number, p1: number, p2: number, p3: number): number {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  }

  function solveT(tx: number, x0: number, x1: number, x2: number, x3: number): number {
    let lo = 0, hi = 1;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (cubic(mid, x0, x1, x2, x3) < tx) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function applyAutoHandles(kfs: Kf[]): Kf[] {
    return kfs.map((kf, i) => {
      const prev = kfs[i - 1], next = kfs[i + 1];
      let slope = 0;
      if (prev && next) slope = (next.value - prev.value) / (next.frame - prev.frame);
      else if (next)    slope = (next.value - kf.value)  / (next.frame - kf.frame);
      else if (prev)    slope = (kf.value - prev.value)  / (kf.frame  - prev.frame);
      const outX = next ? kf.frame + (next.frame - kf.frame) / 3 : kf.frame;
      const inX  = prev ? kf.frame - (kf.frame - prev.frame) / 3 : kf.frame;
      return {
        ...kf,
        handleOut: { x: outX, y: kf.value + slope * (outX - kf.frame) },
        handleIn:  { x: inX,  y: kf.value + slope * (inX  - kf.frame) },
      };
    });
  }

  // ── State ──────────────────────────────────────────────────────────────────

  let curveFps    = $state(24);
  let totalFrames = $state(120);

  let idCounter = 0;
  function newId() { return `kf_${idCounter++}`; }

  function makeDefault(): Kf[] {
    return applyAutoHandles([
      { id: newId(), frame: 0,            value: 1, handleIn: { x: 0,            y: 1 }, handleOut: { x: 0,            y: 1 }, mode: "auto" },
      { id: newId(), frame: totalFrames,  value: 1, handleIn: { x: totalFrames,  y: 1 }, handleOut: { x: totalFrames,  y: 1 }, mode: "auto" },
    ]);
  }

  let keyframes = $state<Kf[]>(makeDefault());

  // ── Canvas ────────────────────────────────────────────────────────────────

  const HANDLE_R   = 5;
  const KF_R       = 6;
  const TRACK_COLOR = "#5db8e8";

  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;
  let dpr = 1;

  let vxMin = $state(-5);
  let vxMax = $state(130);
  let vyMin = $state(-0.3);
  let vyMax = $state(4.3);

  type Sel = { kfId: string } | null;
  let selected = $state<Sel>(null);

  type DragState =
    | { type: "pan";      lastX: number; lastY: number }
    | { type: "keyframe"; kfId: string;  downX: number; downY: number }
    | { type: "handle";   kfId: string;  which: "in" | "out" }
    | null;
  let dragState: DragState = null;

  // ── Coordinate transforms ─────────────────────────────────────────────────

  function fw() { return canvas ? canvas.width  / dpr : 1; }
  function fh() { return canvas ? canvas.height / dpr : 1; }

  function toPixel(frame: number, value: number) {
    return {
      x: ((frame - vxMin) / (vxMax - vxMin)) * fw(),
      y: (1 - (value - vyMin) / (vyMax - vyMin)) * fh(),
    };
  }

  function fromPixel(px: number, py: number) {
    return {
      frame: vxMin + (px / fw()) * (vxMax - vxMin),
      value: vyMin + (1 - py / fh()) * (vyMax - vyMin),
    };
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const w = fw(), h = fh();
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1b1b1b";
    ctx.fillRect(0, 0, w, h);
    drawGrid(ctx, w, h);
    drawSpeedOneLine(ctx, w);
    drawCurve(ctx);
    drawKeyframes(ctx);
    ctx.restore();
  }

  function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1;

    const xStep = pickStep(vxMax - vxMin, w, 60);
    const firstX = Math.ceil(vxMin / xStep) * xStep;
    for (let f = firstX; f <= vxMax; f += xStep) {
      const { x } = toPixel(f, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.fillStyle = "#555";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(Math.round(f)), x, h - 4);
    }

    const yStep = pickStep(vyMax - vyMin, h, 40);
    const firstY = Math.ceil(vyMin / yStep) * yStep;
    for (let v = firstY; v <= vyMax; v += yStep) {
      const { y } = toPixel(0, v);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillStyle = "#555";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(v.toFixed(v % 1 === 0 ? 0 : 2), 4, y - 3);
    }

    // Y=0 axis
    ctx.strokeStyle = "#444"; ctx.lineWidth = 1;
    const { x: x0 } = toPixel(0, 0);
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, h); ctx.stroke();
  }

  /** Dashed reference line at speed = 1 */
  function drawSpeedOneLine(ctx: CanvasRenderingContext2D, w: number) {
    const { y } = toPixel(0, 1.0);
    ctx.strokeStyle = "#ffffff18";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCurve(ctx: CanvasRenderingContext2D) {
    const kfs = keyframes;
    if (kfs.length === 0) return;
    ctx.strokeStyle = TRACK_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    if (kfs[0].frame > vxMin) {
      const p0 = toPixel(vxMin, kfs[0].value);
      const p1 = toPixel(kfs[0].frame, kfs[0].value);
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    }

    for (let i = 0; i < kfs.length - 1; i++) {
      const k0 = kfs[i], k1 = kfs[i + 1];
      const p0 = toPixel(k0.frame,       k0.value);
      const p1 = toPixel(k0.handleOut.x, k0.handleOut.y);
      const p2 = toPixel(k1.handleIn.x,  k1.handleIn.y);
      const p3 = toPixel(k1.frame,       k1.value);
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }

    const last = kfs[kfs.length - 1];
    if (last.frame < vxMax) {
      const p0 = toPixel(last.frame, last.value);
      const p1 = toPixel(vxMax, last.value);
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    }

    ctx.stroke();
  }

  function drawKeyframes(ctx: CanvasRenderingContext2D) {
    for (const kf of keyframes) {
      const isSel = selected?.kfId === kf.id;
      const { x, y } = toPixel(kf.frame, kf.value);

      if (isSel) {
        const hi = toPixel(kf.handleIn.x,  kf.handleIn.y);
        const ho = toPixel(kf.handleOut.x, kf.handleOut.y);
        ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(hi.x, hi.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ho.x, ho.y); ctx.stroke();
        [hi, ho].forEach(({ x: hx, y: hy }) => {
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(hx, hy, HANDLE_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        });
      }

      ctx.fillStyle   = isSel ? "#fff" : TRACK_COLOR;
      ctx.strokeStyle = isSel ? TRACK_COLOR : "#fff4";
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.arc(x, y, KF_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  function pickStep(range: number, size: number, minPx: number): number {
    const candidates = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
    for (const s of candidates) {
      if ((s / range) * size >= minPx) return s;
    }
    return candidates[candidates.length - 1];
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  onMount(() => {
    dpr = window.devicePixelRatio || 1;
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  });

  function resize() {
    if (!canvas || !container) return;
    dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width  = rect.width  + "px";
    canvas.style.height = rect.height + "px";
    draw();
  }

  $effect(() => {
    keyframes; selected; vxMin; vxMax; vyMin; vyMax;
    draw();
  });

  // ── Pointer interaction ───────────────────────────────────────────────────

  function cpx(e: PointerEvent | MouseEvent) {
    return (e.clientX - canvas.getBoundingClientRect().left) / dpr;
  }
  function cpy(e: PointerEvent | MouseEvent) {
    return (e.clientY - canvas.getBoundingClientRect().top)  / dpr;
  }

  function hitKf(px: number, py: number): Kf | null {
    for (const kf of keyframes) {
      const { x, y } = toPixel(kf.frame, kf.value);
      if (Math.hypot(px - x, py - y) <= KF_R + 2) return kf;
    }
    return null;
  }

  function hitHandle(px: number, py: number): { kf: Kf; which: "in" | "out" } | null {
    if (!selected) return null;
    const kf = keyframes.find(k => k.id === selected!.kfId);
    if (!kf) return null;
    const hi = toPixel(kf.handleIn.x,  kf.handleIn.y);
    const ho = toPixel(kf.handleOut.x, kf.handleOut.y);
    if (Math.hypot(px - hi.x, py - hi.y) <= HANDLE_R + 2) return { kf, which: "in" };
    if (Math.hypot(px - ho.x, py - ho.y) <= HANDLE_R + 2) return { kf, which: "out" };
    return null;
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      dragState = { type: "pan", lastX: cpx(e), lastY: cpy(e) };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    const px = cpx(e), py = cpy(e);

    const hh = hitHandle(px, py);
    if (hh) {
      dragState = { type: "handle", kfId: hh.kf.id, which: hh.which };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const hk = hitKf(px, py);
    if (hk) {
      selected = { kfId: hk.id };
      const { frame, value } = fromPixel(px, py);
      dragState = { type: "keyframe", kfId: hk.id, downX: frame, downY: value };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    selected = null;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragState) return;
    const px = cpx(e), py = cpy(e);

    if (dragState.type === "pan") {
      const df = ((dragState.lastX - px) / fw()) * (vxMax - vxMin);
      const dv = ((py - dragState.lastY) / fh()) * (vyMax - vyMin);
      vxMin += df; vxMax += df;
      vyMin += dv; vyMax += dv;
      dragState = { ...dragState, lastX: px, lastY: py };
      return;
    }

    if (dragState.type === "keyframe") {
      const cur = fromPixel(px, py);
      const dFrame = cur.frame - dragState.downX;
      const dValue = cur.value - dragState.downY;
      keyframes = keyframes.map(kf => {
        if (kf.id !== dragState!.kfId) return kf;
        return {
          ...kf,
          frame:     Math.round(kf.frame + dFrame),
          value:     kf.value + dValue,
          handleIn:  { x: kf.handleIn.x  + dFrame, y: kf.handleIn.y  + dValue },
          handleOut: { x: kf.handleOut.x + dFrame, y: kf.handleOut.y + dValue },
        };
      });
      const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
      keyframes = sorted.some(k => k.mode === "auto") ? applyAutoHandles(sorted) : sorted;
      dragState = { ...dragState, downX: cur.frame, downY: cur.value };
      return;
    }

    if (dragState.type === "handle") {
      const { frame, value } = fromPixel(px, py);
      const which = dragState.which;
      keyframes = keyframes.map(kf => {
        if (kf.id !== dragState!.kfId) return kf;
        return { ...kf, mode: "free" as const, [which === "in" ? "handleIn" : "handleOut"]: { x: frame, y: value } };
      });
    }
  }

  function onPointerUp() { dragState = null; }

  function onDblClick(e: MouseEvent) {
    const px = cpx(e), py = cpy(e);
    // Don't add if we hit an existing keyframe
    if (hitKf(px, py)) return;
    const { frame, value } = fromPixel(px, py);
    const id = newId();
    const sorted = [...keyframes, {
      id, frame: Math.round(frame), value: Math.max(0.01, value),
      handleIn: { x: frame, y: value }, handleOut: { x: frame, y: value }, mode: "auto" as const,
    }].sort((a, b) => a.frame - b.frame);
    keyframes = applyAutoHandles(sorted);
    selected = { kfId: id };
  }

  function onKeyDown(e: KeyboardEvent) {
    if ((e.key === "Delete" || e.key === "Backspace") && selected) {
      keyframes = applyAutoHandles(keyframes.filter(k => k.id !== selected!.kfId));
      selected = null;
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const px = cpx(e as unknown as PointerEvent);
    const py = cpy(e as unknown as PointerEvent);
    const { frame: pf, value: pv } = fromPixel(px, py);
    const factor = e.deltaY > 0 ? 1.12 : 0.88;

    if (e.shiftKey) {
      const rv = (vyMax - vyMin) * factor, ry = (pv - vyMin) / (vyMax - vyMin);
      vyMin = pv - ry * rv; vyMax = pv + (1 - ry) * rv;
    } else if (e.ctrlKey) {
      const rx = (pf - vxMin) / (vxMax - vxMin), rn = (vxMax - vxMin) * factor;
      vxMin = pf - rx * rn; vxMax = pf + (1 - rx) * rn;
    } else {
      const rx = (pf - vxMin) / (vxMax - vxMin), ry = (pv - vyMin) / (vyMax - vyMin);
      const rn = (vxMax - vxMin) * factor, rv = (vyMax - vyMin) * factor;
      vxMin = pf - rx * rn; vxMax = pf + (1 - rx) * rn;
      vyMin = pv - ry * rv; vyMax = pv + (1 - ry) * rv;
    }
  }

  function fitView() {
    if (keyframes.length === 0) return;
    const fMin = Math.min(...keyframes.map(k => k.frame));
    const fMax = Math.max(...keyframes.map(k => k.frame));
    const vMin = Math.min(...keyframes.map(k => k.value));
    const vMax = Math.max(...keyframes.map(k => k.value));
    const fp = (fMax - fMin) * 0.1 || 5;
    const vp = (vMax - vMin) * 0.15 || 0.5;
    vxMin = fMin - fp; vxMax = fMax + fp;
    vyMin = vMin - vp; vyMax = vMax + vp;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function exportCurve() {
    const data = {
      curveFps,
      keyframes: keyframes.map(({ id: _id, mode: _mode, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "speed-curve.json"; a.click();
    URL.revokeObjectURL(url);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="panel" role="region" tabindex="0" onkeydown={onKeyDown}>
  <div class="toolbar">
    <span class="title">Speed Remap</span>
    <button class="tbtn" onclick={fitView}>Fit</button>
    <label class="field">
      fps
      <input
        type="number" value={curveFps} min="1" max="120"
        oninput={(e) => { const v = parseInt((e.target as HTMLInputElement).value); if (v > 0) curveFps = v; }}
      />
    </label>
    <label class="field">
      frames
      <input
        type="number" value={totalFrames} min="1"
        oninput={(e) => { const v = parseInt((e.target as HTMLInputElement).value); if (v > 0) totalFrames = v; }}
      />
    </label>
    <button class="tbtn export" onclick={exportCurve}>Export JSON</button>
    <span class="hint">dbl-click=add kf · del=remove · scroll=zoom · alt+drag=pan · shift/ctrl=zoom Y/X</span>
  </div>

  <div class="canvas-wrap" bind:this={container}>
    <canvas
      bind:this={canvas}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      ondblclick={onDblClick}
      onwheel={onWheel}
      style="cursor: crosshair"
    ></canvas>
  </div>
</div>

<style>
  .panel {
    width: 100%; height: 100%;
    display: grid;
    grid-template-rows: 28px 1fr;
    overflow: hidden;
    background: #1b1b1b;
    outline: none;
  }
  .toolbar {
    display: flex; align-items: center; gap: 8px;
    padding: 0 8px;
    background: var(--color-header);
    border-bottom: 1px solid var(--color-border);
  }
  .title { font-size: 11px; color: var(--color-text-dim); font-weight: 600; }
  .tbtn {
    background: var(--color-border); border: none;
    color: var(--color-text); font-size: 11px; padding: 2px 8px;
    border-radius: 3px; cursor: pointer;
  }
  .tbtn:hover { background: var(--color-accent); }
  .tbtn.export { background: #2e4a2e; }
  .tbtn.export:hover { background: #3a6a3a; }
  .field {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; color: var(--color-text-dim);
  }
  .field input {
    width: 52px;
    background: var(--color-bg); border: 1px solid var(--color-border);
    color: var(--color-text); font-size: 11px; padding: 1px 4px;
    border-radius: 3px;
  }
  .hint { font-size: 10px; color: #444; margin-left: auto; }
  .canvas-wrap { position: relative; overflow: hidden; }
  canvas { display: block; }
</style>
