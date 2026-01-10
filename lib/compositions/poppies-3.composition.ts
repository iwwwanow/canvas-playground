import { Composition } from "../classes";
import { Layer } from "../classes";
import { Channel } from "../classes/composition.interfaces";
import { BlendMod } from "../classes";

import { CANVAS_ID } from "./poppies-3.constants";
import { IMG_QUERY_SELECTOR } from "./poppies-3.constants";

export const drawPoppies3 = () => {
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

  const redLayer = new Layer(redLayerArrayData);
  redLayer.setBlendMode(BlendMod.add);
  composition.addLayer(redLayer);

  const greenLayer = new Layer(greenLayerArrayData);
  greenLayer.setBlendMode(BlendMod.add);
  composition.addLayer(greenLayer);

  const blueLayer = new Layer(blueLayerArrayData);
  blueLayer.setBlendMode(BlendMod.add);
  composition.addLayer(blueLayer);

  composition.render();
};
