import { Composition } from "../../lib";

const CANVAS_ID = "canvas-4";
const IMG_QUERY_SELECTOR = "#source-4";
const IMAGE_WIDTH = 300;
const IMAGE_HEIGHT = 400;

export const drawPoppies4 = () => {
  const composition = new Composition({
    canvasId: CANVAS_ID,
    imgQuerySelector: IMG_QUERY_SELECTOR,
    options: {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    },
  });

  composition.init();

  const originalImageData = composition.imageData?.data;
  if (!originalImageData) throw new Error("image data not defined");

  composition.render();
};

drawPoppies4();
