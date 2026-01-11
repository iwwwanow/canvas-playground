import { Composition } from "../../lib";
import { Layer } from "../../lib";

import { TransformType } from "../../lib";

const CANVAS_ID = "canvas-4";
const IMG_QUERY_SELECTOR = "#source-4";

export const drawPoppies4 = () => {
  const composition = new Composition({
    canvasId: CANVAS_ID,
    imgQuerySelector: IMG_QUERY_SELECTOR,
    options: {
      width: 128,
      height: 128,
    },
  });

  composition.init();

  const originalImageData = composition.imageData?.data;
  if (!originalImageData) throw new Error("image data not defined");
  console.log(originalImageData.length);

  const whiteLayer = new Layer(originalImageData.map(() => 255));
  composition.addLayer(whiteLayer);

  const opacityLayer = new Layer(originalImageData);
  opacityLayer.setTransform(TransformType.Translate, 25, 25);

  opacityLayer.setOpacity(1);
  composition.addLayer(opacityLayer);
  composition.render();
};

drawPoppies4();
