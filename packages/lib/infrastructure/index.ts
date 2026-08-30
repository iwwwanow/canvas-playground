export { assembleGif } from "./assemble-gif";
import { createCanvas, loadImage } from "canvas";
import { writeFile } from "fs/promises";
import type { ImageRawDataArray, LayerDimensions } from "../domain/types";

export async function imageFileToRawData(
  path: string
): Promise<{ data: ImageRawDataArray } & LayerDimensions> {
  const img = await loadImage(path);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  return { data: data as ImageRawDataArray, width, height };
}

export async function rawDataToImageFile(
  data: ImageRawDataArray,
  dimensions: LayerDimensions,
  outputPath: string
): Promise<void> {
  const canvas = createCanvas(dimensions.width, dimensions.height);
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(dimensions.width, dimensions.height);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);
  const buffer = canvas.toBuffer("image/png");
  await writeFile(outputPath, buffer);
}
