import { parseArgs } from "util";
import { resolve } from "path";
import { mkdir } from "fs/promises";
import {
  Composition,
  imageFileToRawData,
  rawDataToImageFile,
} from "@xtc-toaster/lib";
import { Color } from "@xtc-toaster/lib";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    input: { type: "string", short: "i" },
  },
});

const inputPath =
  values.input ?? resolve(import.meta.dirname, "assets/degas-076.sm.jpg");

const outputDir = resolve(process.cwd(), "tmp/outputs");
const outputPath = resolve(outputDir, `${Date.now()}_degas.png`);

await mkdir(outputDir, { recursive: true });

console.log("[toast-1/degas] input:", inputPath);

const { data, width, height } = await imageFileToRawData(inputPath);

const composition = new Composition(width, height);
const whiteLayer = composition.createBlankLayer();
const whiteColor = Color.fromHex("#FFFFFF");
whiteLayer.fill(whiteColor);
const layer = composition.createLayerFromPixelData(data);
layer.mask({ name: "hue", value: 240, tolerance: 0.1 }); // red hue, 0°

const result = composition.render();
await rawDataToImageFile(result, { width, height }, outputPath);

console.log("[toast-1/degas] →", outputPath);
