import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import sharp from "sharp";
import { toasts } from "@xtc-toaster/core";
import { parseParams } from "./run.js";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".tiff", ".avif"]);
const CONCURRENCY = 4;

interface BatchOptions {
  output: string;
  param: string[];
}

async function resolveInputPaths(input: string): Promise<string[]> {
  if (input.endsWith(".txt")) {
    const text = await readFile(input, "utf-8");
    return text.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  const entries = await readdir(input, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && IMAGE_EXTS.has(extname(e.name).toLowerCase()))
    .map((e) => join(input, e.name));
}

async function processOne(
  slug: string,
  inputPath: string,
  outputDir: string,
  params: Record<string, unknown>,
  index: number,
  total: number,
): Promise<void> {
  const toast = toasts[slug];
  const filename = basename(inputPath);

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = await toast.bake(
    new Uint8ClampedArray(data.buffer),
    info.width,
    info.height,
    params,
  );

  const outputPath = join(outputDir, filename);

  if (output.type === "image") {
    await sharp(Buffer.from(output.data.buffer), {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).toFile(outputPath);
  }

  console.log(`[${index}/${total}] ${filename} → done`);
}

export async function batchCommand(slug: string, opts: BatchOptions & { input: string }) {
  const toast = toasts[slug];
  if (!toast) {
    const available = Object.keys(toasts).join(", ");
    console.error(`Unknown toast: "${slug}". Available: ${available}`);
    process.exit(1);
  }

  if (!existsSync(opts.output)) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(opts.output, { recursive: true });
  }

  const inputPaths = await resolveInputPaths(opts.input);
  if (inputPaths.length === 0) {
    console.error("No images found in input.");
    process.exit(1);
  }

  const params = parseParams(opts.param);
  const total = inputPaths.length;
  const start = Date.now();

  console.log(`Baking ${total} images with "${toast.meta.name}"...`);

  // Process in batches of CONCURRENCY
  for (let i = 0; i < inputPaths.length; i += CONCURRENCY) {
    const chunk = inputPaths.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map((inputPath, j) =>
        processOne(slug, inputPath, opts.output, params, i + j + 1, total)
      )
    );
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✓ ${total} files processed in ${elapsed}s`);
}
