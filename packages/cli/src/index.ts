import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { listCommand } from "./commands/list.js";
import { publishCommand } from "./commands/publish.js";
import { runCommand } from "./commands/run.js";
import { batchCommand } from "./commands/batch.js";
import {
  mosaicSegmentCommand,
  mosaicFramesCommand,
  mosaicRenderCommand,
  mosaicBatchRenderCommand,
  collectAssetsCommand,
  indexAssetsCommand,
} from "./commands/mosaic.js";

const program = new Command();

program
  .name("toast")
  .description("xtc-toaster CLI — publish and manage toasts")
  .version("0.0.0");

program
  .command("login <login> <password>")
  .description("authenticate and store token locally")
  .action(loginCommand);

program
  .command("list")
  .description("list all published toasts")
  .action(listCommand);

program
  .command("publish")
  .description("publish a new toast")
  .requiredOption("-n, --name <name>", "toast name")
  .requiredOption("-p, --preview <path>", "path to preview gif")
  .option("-d, --description <text>", "optional description")
  .action((opts: { name: string; preview: string; description?: string }) =>
    publishCommand(opts)
  );

program
  .command("run <slug>")
  .description("apply a toast to an image")
  .requiredOption("-i, --input <path>", "input image path")
  .requiredOption("-o, --output <path>", "output image path")
  .option(
    "--param <key=value>",
    "toast parameter (repeatable)",
    (v: string, acc: string[]) => [...acc, v],
    [] as string[],
  )
  .action(async (slug: string, opts: { input: string; output: string; param: string[] }) =>
    runCommand(slug, opts)
  );

program
  .command("batch <slug>")
  .description("apply a toast to all images in a directory or list file")
  .requiredOption("-i, --input <path>", "input directory or .txt file with paths")
  .requiredOption("-o, --output <path>", "output directory")
  .option(
    "--param <key=value>",
    "toast parameter (repeatable)",
    (v: string, acc: string[]) => [...acc, v],
    [] as string[],
  )
  .action(async (slug: string, opts: { input: string; output: string; param: string[] }) =>
    batchCommand(slug, opts)
  );

const mosaic = program
  .command("mosaic")
  .description("mosaic toast pipeline: segment an image, then render a mosaic video");

mosaic
  .command("segment")
  .description("segment a single image into posterized regions and save rectangles")
  .requiredOption("-i, --input <path>", "input image path")
  .requiredOption("-o, --output <dir>", "output directory for segments.json and debug.png")
  .option("--tones <n>", "tone (Value) quantization levels (default 6)", parseInt)
  .option("--hues <n>", "hue quantization levels (default 6)", parseInt)
  .option("--min-region <n>", "min pixels per region (default 200)", parseInt)
  .action((opts: { input: string; output: string; tones?: number; hues?: number; minRegion?: number }) =>
    mosaicSegmentCommand(opts)
  );

mosaic
  .command("frames")
  .description("extract video frames and overlay posterized rectangles — preview before render")
  .requiredOption("-i, --input <path>", "input video path")
  .requiredOption("-o, --output <dir>", "output dir for PNG sequence and segments.json")
  .option("--fps <n>", "extraction fps (default 24)", parseInt)
  .option("--tones <n>", "tone quantization levels (default 6)", parseInt)
  .option("--hues <n>", "hue quantization levels (default 6)", parseInt)
  .option("--min-region <n>", "min pixels per region (default 200)", parseInt)
  .action((opts: {
    input: string; output: string; fps?: number;
    tones?: number; hues?: number; minRegion?: number;
  }) => mosaicFramesCommand(opts));

mosaic
  .command("index-assets")
  .description("scan assets dir, build 160×160 cache and save index.json for fast render")
  .requiredOption("--assets <dir>", "assets directory (same as used in render)")
  .option(
    "--extra <dir>",
    "extra source directory to include (repeatable)",
    (v: string, acc: string[]) => [...acc, v],
    [] as string[],
  )
  .action((opts: { assets: string; extra: string[] }) => indexAssetsCommand(opts));

mosaic
  .command("collect-assets")
  .description("download images from Lorem Picsum for use as tile assets")
  .requiredOption("-o, --output <dir>", "output directory for downloaded images")
  .option("--count <n>", "number of images to download (default 20)", parseInt)
  .option("--query <text>", "seed/tag for image variety")
  .action((opts: { output: string; count?: number; query?: string }) =>
    collectAssetsCommand(opts)
  );

mosaic
  .command("render")
  .description("render mosaic video from segments.json + assets directory")
  .requiredOption("--segments <path>", "path to segments.json")
  .requiredOption("--assets <dir>", "directory with video/image/gif assets (or subdirs with PNG sequences)")
  .requiredOption("-o, --output <path>", "output mp4 or gif path")
  .option("--duration <s>", "output duration in seconds (default 5)", parseFloat)
  .option("--fps <n>", "frames per second (default 24)", parseInt)
  .option("--format <fmt>", "output format: mp4 or gif (default mp4)")
  .option("--mode <mode>", "tile mode: photo (default) or solid (flat segment color)")
  .option("--max-tile <n>", "max cell size px; large segments subdivided into grid, each cell its own asset", parseInt)
  .option("--min-tile <n>", "min cell size px; small segments padded up to this size", parseInt)
  .option("--tint-tiles", "overlay-blend each photo tile with its segment color (texture + palette)")
  .option("--tint-strength <n>", "tint overlay opacity 0–1 (default 1.0)", parseFloat)
  .option("--gradient-map", "remap luminance: darks→segment color, lights→white")
  .option("--hue-tiles", "replace photo hue with segment color hue, keep luminance+saturation")
  .option("--blur-tiles", "blur each tile proportionally to its size (softer, painterly)")
  .option("--boost-tiles", "parabolic contrast boost per tile: bright→whiter, dark→darker, mid unaffected")
  .option("--boost-strength <n>", "boost intensity 0–1 (default 0.3)", parseFloat)
  .option("--no-save-frames", "skip saving JPEG frame sequence alongside output")
  .action((opts: {
    segments: string; assets: string; output: string;
    duration?: number; fps?: number; format?: "mp4" | "gif"; mode?: "photo" | "solid"; saveFrames?: boolean; maxTile?: number; minTile?: number; tintTiles?: boolean; tintStrength?: number; gradientMap?: boolean; hueTiles?: boolean; boostTiles?: boolean; boostStrength?: number; blurTiles?: boolean;
  }) => mosaicRenderCommand(opts));

mosaic
  .command("batch-render")
  .description("render multiple segments.json into videos, loading assets only once")
  .requiredOption("--segments <paths...>", "one or more segments.json paths")
  .requiredOption("--assets <dir>", "directory with assets")
  .requiredOption("-o, --output-dir <dir>", "output directory for rendered videos")
  .option("--duration <s>", "output duration in seconds (default 5)", parseFloat)
  .option("--fps <n>", "frames per second (default 24)", parseInt)
  .option("--format <fmt>", "output format: mp4 or gif (default mp4)")
  .action((opts: {
    segments: string[]; assets: string; outputDir: string;
    duration?: number; fps?: number; format?: "mp4" | "gif";
  }) => mosaicBatchRenderCommand(opts));

program.parse();
