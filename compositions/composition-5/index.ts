import { Composition } from "../../lib";
import { Layer } from "../../lib";

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

  const levelLayerArrayData = composition.cutLevel(originalImageData, 0.8);
  const levelLayer = new Layer(levelLayerArrayData);

  composition.addLayer(levelLayer);
  composition.render();
};

drawPoppies4();
