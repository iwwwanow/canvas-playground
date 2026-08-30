import { parseArgs } from "util";
import { resolve } from "path";
import { mkdir } from "fs/promises";
import {
  Composition,
  imageFileToRawData,
  rawDataToImageFile,
  assembleGif,
} from "@xtc-toaster/lib";
import { Color } from "@xtc-toaster/lib";
import type { ImageRawDataArray, Quad } from "@xtc-toaster/lib";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    input: { type: "string", short: "i" },
  },
});

const inputPath =
  values.input ?? resolve(import.meta.dirname, "assets/degas-076.sm.jpg");

const FRAME_COUNT = 12;
const FPS = 12;

const timestamp = Date.now();
const seqDir = resolve(process.cwd(), `tmp/outputs/sqnc_${timestamp}_degas`);
const gifPath = resolve(process.cwd(), `tmp/outputs/sqnc_${timestamp}_degas.gif`);

await mkdir(seqDir, { recursive: true });

console.log("[toast-1/degas] input:", inputPath);

const { data, width, height } = await imageFileToRawData(inputPath);

const getTransformCorners = (gapModifier: number = 0.1): Quad => {
  const widthGapBase = (0.33 / 3) * width;
  const heightGapBase = (0.33 / 3) * height;
  const widthGap = widthGapBase * gapModifier;
  const heightGap = heightGapBase * gapModifier;
  return [
    { x: 0 + 2 * widthGap, y: 0 + 2 * heightGap },
    { x: width - 3 * widthGap, y: 0 + 3 * heightGap },
    { x: width - widthGap, y: height - heightGap },
    { x: 0, y: height },
  ];
};

const getBlurRadius = (blurModifier: number): number => {
  return Math.round((width * blurModifier) / 100);
};

const getTransformParams = ({ tx, ty }: { tx: number; ty: number }) => ({
  tx: Math.round(tx * width * 0.01),
  ty: Math.round(ty * height * 0.01),
});

const darkGrayColor = Color.fromHex("#a4a4a4");
const lightGrayColor = Color.fromHex("#ebebeb");
const blueColor = Color.fromHex("#00ffdd");

const buildFrame = (frame: number): ImageRawDataArray => {
  const comp = new Composition(width, height);

  const bg = comp.createBlankLayer();
  bg.fill(darkGrayColor);

  const blurred = comp.createLayerFromPixelData(data);
  blurred.applyEffect({ name: "blur", options: { radius: getBlurRadius(0.8) } });
  blurred.setOpacity(0.8);

  const lightGray = comp.createBlankLayer();
  lightGray.fill(lightGrayColor);
  lightGray.setOpacity(0.6);

  const blueBg = comp.createBlankLayer();
  blueBg.fill(blueColor);
  blueBg.setOpacity(0.8);
  blueBg.setBlendMode("lch-hue");

  const purple = comp.createLayerFromPixelData(data);
  purple.mask({ name: "value", value: 16, tolerance: 0.32 });
  purple.tint(Color.fromHex("#FF00FF"));
  purple.applyEffect({ name: "blur", options: { radius: getBlurRadius(0.24) } });
  purple.setOpacity(0.6 * frame);
  purple.setTransform({ name: "perspective", params: { corners: getTransformCorners(0.1 * frame) } });
  purple.setTransform({ name: "translate", params: getTransformParams({ tx: 1 * frame, ty: -1 * frame }) });

  const red = comp.createLayerFromPixelData(data);
  red.mask({ name: "value", value: 12, tolerance: 0.24 });
  red.tint(Color.fromHex("#FF0000"));
  red.applyEffect({ name: "blur", options: { radius: getBlurRadius(0.1) } });
  red.setOpacity(0.8 * frame);
  red.setTransform({ name: "perspective", params: { corners: getTransformCorners(0.2 * frame) } });
  red.setTransform({ name: "translate", params: getTransformParams({ tx: 2 * frame, ty: -2 * frame }) });

  const white = comp.createLayerFromPixelData(data);
  white.mask({ name: "value", value: 92, tolerance: 0.16 });
  white.tint(Color.fromHex("#FFFFFF"));
  white.setTransform({ name: "perspective", params: { corners: getTransformCorners(0.1 * frame) } });
  white.setTransform({ name: "translate", params: getTransformParams({ tx: 1 * frame, ty: -1 * frame }) });

  return comp.render();
};

const renderedFrames: ImageRawDataArray[] = [];

for (let i = 0; i < FRAME_COUNT; i++) {
  const t = i / (FRAME_COUNT - 1);
  console.log(`[toast-1/degas] frame ${i + 1}/${FRAME_COUNT} (t=${t.toFixed(2)})`);

  const rendered = buildFrame(t);
  renderedFrames.push(rendered);

  const framePath = resolve(seqDir, `frame_${String(i).padStart(4, "0")}.png`);
  await rawDataToImageFile(rendered, { width, height }, framePath);
}

console.log(`[toast-1/degas] assembling gif → ${gifPath}`);
await assembleGif(renderedFrames, width, height, FPS, gifPath);
console.log("[toast-1/degas] done →", gifPath);
