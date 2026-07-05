/**
 * Floating REC buttons for any composition page.
 *
 * ⏺ WEBM  — records canvas stream via MediaRecorder, downloads .webm
 * 📷 SEQ   — captures PNG frames every rAF, zips with fflate, downloads .zip
 *
 * Usage: import "../shared/recorder" at the top of composition index.ts
 */

import { zip } from "fflate";

const WEBM_DURATION_MS = 6000;
const SEQ_FRAMES = 120; // 4s @ 30fps

// ── rAF pause patch ─────────────────────────────────────────────────────────

let rafPaused = false;
let pendingRafCb: FrameRequestCallback | null = null;
const originalRaf = window.requestAnimationFrame.bind(window);

window.requestAnimationFrame = (cb: FrameRequestCallback) => {
  if (rafPaused) {
    pendingRafCb = cb;   // park the last callback
    return 0;
  }
  return originalRaf(cb);
};

function pauseRaf() { rafPaused = true; }

function resumeRaf() {
  rafPaused = false;
  if (pendingRafCb) {
    const cb = pendingRafCb;
    pendingRafCb = null;
    originalRaf(cb);   // kick the loop back off
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function canvasToPngBytes(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL("image/png");
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function compositionName() {
  return location.pathname.split("/").at(-2) ?? "composition";
}

// ── button factory ──────────────────────────────────────────────────────────

function makeBtn(label: string) {
  const btn = document.createElement("button");
  btn.textContent = label;
  Object.assign(btn.style, {
    fontFamily: "system-ui, sans-serif",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: ".06em",
    padding: "6px 10px",
    borderRadius: "4px",
    border: "1px solid #444",
    background: "#1a1a1a",
    color: "#e0e0e0",
    cursor: "pointer",
    userSelect: "none",
  });
  return btn;
}

// ── WEBM mode ───────────────────────────────────────────────────────────────

function initWebm(canvas: HTMLCanvasElement, btn: HTMLButtonElement) {
  let recorder: MediaRecorder | null = null;

  btn.addEventListener("click", () => {
    if (recorder?.state === "recording") {
      recorder.stop();
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      downloadBlob(new Blob(chunks, { type: mimeType }), `${compositionName()}.webm`);
      btn.textContent = "⏺ WEBM";
      btn.style.color = "#e0e0e0";
      btn.style.borderColor = "#444";
    };

    recorder.start();
    btn.textContent = "⏹ STOP";
    btn.style.color = "#ff5555";
    btn.style.borderColor = "#ff5555";
    setTimeout(() => recorder?.state === "recording" && recorder.stop(), WEBM_DURATION_MS);
  });
}

// ── PNG sequence mode ───────────────────────────────────────────────────────

function initSeq(canvas: HTMLCanvasElement, btn: HTMLButtonElement) {
  let capturing = false;
  let frames: Uint8Array[] = [];
  let rafId: number;

  function capture() {
    if (!capturing) return;
    frames.push(canvasToPngBytes(canvas));

    const n = frames.length;
    btn.textContent = `⏹ ${n}/${SEQ_FRAMES}`;

    if (n >= SEQ_FRAMES) {
      stop();
    } else {
      rafId = requestAnimationFrame(capture);
    }
  }

  function stop() {
    capturing = false;
    cancelAnimationFrame(rafId);
    btn.textContent = "📦 zipping…";
    btn.style.color = "#e0e0e0";
    btn.style.borderColor = "#444";

    const name = compositionName();
    const files: Record<string, Uint8Array> = {};
    frames.forEach((f, i) => {
      files[`${name}_${String(i).padStart(4, "0")}.png`] = f;
    });

    zip(files, { level: 0 }, (err, data) => {
      if (!err) downloadBlob(new Blob([data], { type: "application/zip" }), `${name}_seq.zip`);
      btn.textContent = "📷 SEQ";
      frames = [];
    });
  }

  btn.addEventListener("click", () => {
    if (capturing) { stop(); return; }
    frames = [];
    capturing = true;
    btn.textContent = `⏹ 0/${SEQ_FRAMES}`;
    btn.style.color = "#ff5555";
    btn.style.borderColor = "#ff5555";
    rafId = requestAnimationFrame(capture);
  });
}

// ── init ────────────────────────────────────────────────────────────────────

function init() {
  const canvas = document.querySelector("canvas");
  if (!canvas) return;

  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: "999",
    display: "flex",
    gap: "6px",
  });

  const pauseBtn = makeBtn("⏸ PAUSE");
  pauseBtn.addEventListener("click", () => {
    if (rafPaused) {
      resumeRaf();
      pauseBtn.textContent = "⏸ PAUSE";
      pauseBtn.style.color = "#e0e0e0";
      pauseBtn.style.borderColor = "#444";
    } else {
      pauseRaf();
      pauseBtn.textContent = "▶ PLAY";
      pauseBtn.style.color = "#4a90d9";
      pauseBtn.style.borderColor = "#4a90d9";
    }
  });

  const webmBtn = makeBtn("⏺ WEBM");
  const seqBtn = makeBtn("📷 SEQ");

  initWebm(canvas, webmBtn);
  initSeq(canvas, seqBtn);

  wrap.append(pauseBtn, webmBtn, seqBtn);
  document.body.appendChild(wrap);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
