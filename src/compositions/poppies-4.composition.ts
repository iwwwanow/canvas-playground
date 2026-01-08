import { Composition } from "../classes";
import { Layer } from "../classes";

import { CANVAS_ID } from "./poppies-4.constants";
import { IMG_QUERY_SELECTOR } from "./poppies-4.constants";
import { TransformType } from "../classes";

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
