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

const getTransformCorners = (gapModifier: number = 0.1) => {
  const widthGapBase = (0.33 / 3) * width;
  const heightGapBase = (0.33 / 3) * height;
  const widthGap = widthGapBase * gapModifier;
  const heightGap = heightGapBase * gapModifier;
  const corners = [
    { x: 0 + 2 * widthGap, y: 0 + 2 * heightGap },
    { x: width - 3 * widthGap, y: 0 + 3 * heightGap },
    { x: width - widthGap, y: height - heightGap },
    { x: 0, y: height },
  ];
  return corners;
};

const getBlurRadius = (blurModifier: number): number => {
  return Math.round((width * blurModifier) / 100); // 1% от ширины
};

const getTransformParams = ({ tx, ty }) => {
  return {
    tx: Math.round(tx * width * 0.01),
    ty: Math.round(ty * height * 0.01),
  };
};

const { data, width, height } = await imageFileToRawData(inputPath);

const composition = new Composition(width, height);

const darkGrayGackgroundLayer = composition.createBlankLayer();
const darkGrayBackgroudColor = Color.fromHex("#a4a4a4");
darkGrayGackgroundLayer.fill(darkGrayBackgroudColor);

const bluredLayer = composition.createLayerFromPixelData(data);
bluredLayer.applyEffect({
  name: "blur",
  options: { radius: getBlurRadius(0.8) },
});
bluredLayer.setOpacity(0.8);

const lightGrayBackgroundLayer = composition.createBlankLayer();
const lightGrayBackgroundColor = Color.fromHex("#ebebeb");
lightGrayBackgroundLayer.fill(lightGrayBackgroundColor);
lightGrayBackgroundLayer.setOpacity(0.6);

const blueBackgroundLayer = composition.createBlankLayer();
const blueBackgroundColor = Color.fromHex("#00ffdd");
blueBackgroundLayer.fill(blueBackgroundColor);
blueBackgroundLayer.setOpacity(0.8);
blueBackgroundLayer.setBlendMode("lch-hue");

const purpleLayer = composition.createLayerFromPixelData(data);
const purpleColor = Color.fromHex("#FF00FF");
purpleLayer.mask({ name: "value", value: 16, tolerance: 0.32 });
purpleLayer.tint(purpleColor);
purpleLayer.applyEffect({
  name: "blur",
  options: { radius: getBlurRadius(0.24) },
});
purpleLayer.setOpacity(0.6);
purpleLayer.setTransform({
  name: "perspective",
  params: { corners: getTransformCorners() },
});
purpleLayer.setTransform({
  name: "translate",
  params: getTransformParams({ tx: 1, ty: -1 }),
});

const redLayer = composition.createLayerFromPixelData(data);
const redColor = Color.fromHex("#FF0000");
redLayer.mask({ name: "value", value: 12, tolerance: 0.24 });
redLayer.tint(redColor);
redLayer.applyEffect({
  name: "blur",
  options: { radius: getBlurRadius(0.1) },
});
redLayer.setOpacity(0.8);
redLayer.setTransform({
  name: "perspective",
  params: { corners: getTransformCorners(0.2) },
});
redLayer.setTransform({
  name: "translate",
  params: getTransformParams({ tx: 2, ty: -2 }),
});

const whiteLayer = composition.createLayerFromPixelData(data);
const whiteColor = Color.fromHex("#FFFFFF");
whiteLayer.mask({ name: "value", value: 92, tolerance: 0.16 });
whiteLayer.tint(whiteColor);
whiteLayer.setTransform({
  name: "perspective",
  params: { corners: getTransformCorners(0.1) },
});
whiteLayer.setTransform({
  name: "translate",
  params: getTransformParams({ tx: 1, ty: -1 }),
});

const result = composition.render();
await rawDataToImageFile(result, { width, height }, outputPath);

console.log("[toast-1/degas] →", outputPath);
