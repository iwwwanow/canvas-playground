import sharp from "sharp";
import { toasts } from "@xtc-toaster/core";

interface RunOptions {
  input: string;
  output: string;
  param: string[];
}

export async function runCommand(slug: string, opts: RunOptions) {
  const toast = toasts[slug];
  if (!toast) {
    const available = Object.keys(toasts).join(", ");
    console.error(`Unknown toast: "${slug}". Available: ${available}`);
    process.exit(1);
  }

  const params: Record<string, unknown> = {};
  for (const p of opts.param) {
    const eqIdx = p.indexOf("=");
    if (eqIdx === -1) continue;
    const key = p.slice(0, eqIdx);
    const val = p.slice(eqIdx + 1);
    const num = Number(val);
    params[key] = isNaN(num) ? val : num;
  }

  const { data, info } = await sharp(opts.input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const result = toast.bake(
    new Uint8ClampedArray(data.buffer),
    info.width,
    info.height,
    params,
  );

  await sharp(Buffer.from(result.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).toFile(opts.output);

  console.log(`"${toast.meta.name}" baked → ${opts.output}`);
}
