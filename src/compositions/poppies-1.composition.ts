import { Composition } from "../classes";
import { Layer } from "../classes";
import { Channel } from "../classes/composition.interfaces";

import { CANVAS_ID } from "./poppies-1.constants";
import { IMAGE_SRC } from "./poppies-1.constants";

export const drawPoppies1 = () => {
  const composition = new Composition({
    canvasId: CANVAS_ID,
    imageSrc: IMAGE_SRC,
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
  composition.addLayer(redLayer);

  const greenLayer = new Layer(greenLayerArrayData);
  composition.addLayer(greenLayer);

  const blueLayer = new Layer(blueLayerArrayData);
  composition.addLayer(blueLayer);

  composition.render();
};
