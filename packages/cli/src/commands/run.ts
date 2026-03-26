import sharp from "sharp";
import { toasts } from "@xtc-toaster/core";
import { assembleVideo } from "../lib/assemble-video.js";

export interface RunOptions {
  input: string;
  output: string;
  param: string[];
}

export function parseParams(paramList: string[]): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const p of paramList) {
    const eqIdx = p.indexOf("=");
    if (eqIdx === -1) continue;
    const key = p.slice(0, eqIdx);
    const val = p.slice(eqIdx + 1);
    const num = Number(val);
    params[key] = isNaN(num) ? val : num;
  }
  return params;
}

export async function runCommand(slug: string, opts: RunOptions) {
  const toast = toasts[slug];
  if (!toast) {
    const available = Object.keys(toasts).join(", ");
    console.error(`Unknown toast: "${slug}". Available: ${available}`);
    process.exit(1);
  }

  const params = parseParams(opts.param);

  console.log(`Loading ${opts.input}...`);
  const { data, info } = await sharp(opts.input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`Baking "${toast.meta.name}" (${info.width}×${info.height})...`);
  const output = await toast.bake(
    new Uint8ClampedArray(data.buffer),
    info.width,
    info.height,
    params,
    opts.output,
    (current, total, label) => {
      process.stdout.write(`\r  ${label ?? "progress"}: ${current}/${total}`);
    },
  );
  process.stdout.write("\n");

  if (output.type === "image") {
    await sharp(Buffer.from(output.data.buffer), {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).toFile(opts.output);
    console.log(`"${toast.meta.name}" baked → ${opts.output}`);
  } else if (output.type === "frames") {
    await assembleVideo(output.frames, info.width, info.height, output.fps, output.format, opts.output);
    console.log(`"${toast.meta.name}" rendered → ${opts.output}`);
  } else {
    console.log(`"${toast.meta.name}" rendered → ${output.path}`);
  }
}
