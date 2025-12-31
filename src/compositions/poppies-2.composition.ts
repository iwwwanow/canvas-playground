import { Composition } from "../classes";
import { Layer } from "../classes";
import { Channel } from "../classes/composition.interfaces";

import { CANVAS_ID } from "./poppies-2.constants";
import { IMG_QUERY_SELECTOR } from "./poppies-2.constants";

export const drawPoppies2 = () => {
  const composition = new Composition({
    canvasId: CANVAS_ID,
    imgQuerySelector: IMG_QUERY_SELECTOR,
  });

  composition.init();

  const originalImageData = composition.imageData?.data;
  if (!originalImageData) throw new Error("image data not defined");

  const redLayerArrayData = composition.cutChannel(
    originalImageData,
    Channel.Red,
  );

  const greenLayerArrayData = composition.cutChannel(
    originalImageData,
    Channel.Green,
  );

  const blueLayerArrayData = composition.cutChannel(
    originalImageData,
    Channel.Blue,
  );

  composition.addColorLayer();
  const blueLayer = new Layer(blueLayerArrayData);
  composition.addLayer(blueLayer);

  const greenLayer = new Layer(greenLayerArrayData);
  composition.addLayer(greenLayer);

  const redLayer = new Layer(redLayerArrayData);
  composition.addLayer(redLayer);

  composition.render();
};
