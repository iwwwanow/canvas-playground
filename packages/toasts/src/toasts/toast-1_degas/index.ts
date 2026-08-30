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

const darkGrayGackgroundLayer = composition.createBlankLayer();
const darkGrayBackgroudColor = Color.fromHex("#a4a4a4");
darkGrayGackgroundLayer.fill(darkGrayBackgroudColor);
//
const bluredLayer = composition.createLayerFromPixelData(data);
bluredLayer.applyEffect({ name: "blur", options: { radius: 2 } });
bluredLayer.setOpacity(0.6);

const lightGrayBackgroundLayer = composition.createBlankLayer();
const lightGrayBackgroundColor = Color.fromHex("#ebebeb");
lightGrayBackgroundLayer.fill(lightGrayBackgroundColor);
lightGrayBackgroundLayer.setOpacity(0.8);

const blueBackgroundLayer = composition.createBlankLayer();
const blueBackgroundColor = Color.fromHex("#00ffdd");
blueBackgroundLayer.fill(blueBackgroundColor);
blueBackgroundLayer.setOpacity(0.8);
blueBackgroundLayer.setBlendMode("lch-hue");

const purpleGradientLayer = composition.createLayerFromPixelData(data);
const purpleColor = Color.fromHex("#FF00FF");
purpleGradientLayer.mask({ name: "value", value: 10, tolerance: 0.6 });
purpleGradientLayer.tint(purpleColor);
purpleGradientLayer.setOpacity(0.4);

const widthGapBase = (0.33 / 3) * width;
const heightGapBase = (0.33 / 3) * height;
const gapModifier = 0.1;
const widthGap = widthGapBase * gapModifier;
const heightGap = heightGapBase * gapModifier;
const purpleGradientLayerTransformCorners = [
  { x: 0 + 2 * widthGap, y: 0 + 2 * heightGap },
  { x: width - 3 * widthGap, y: 0 + 3 * heightGap },
  { x: width - widthGap, y: height - heightGap },
  { x: 0, y: height },
];
purpleGradientLayer.setTransform({
  name: "perspective",
  params: { corners: purpleGradientLayerTransformCorners },
});

const result = composition.render();
await rawDataToImageFile(result, { width, height }, outputPath);

console.log("[toast-1/degas] →", outputPath);
