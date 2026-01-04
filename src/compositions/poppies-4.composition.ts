import { Composition } from "../classes";
import { Layer } from "../classes";

import { CANVAS_ID } from "./poppies-4.constants";
import { IMG_QUERY_SELECTOR } from "./poppies-4.constants";

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

  let currentHue = 0;
  const hueStep = 1;
  let animationFrameId: number | null = null;
  let isAnimating = false;

  // TODO: trailing
  // const maxTrailLength = 1; // Максимальное количество слоев в шлейфе
  // const trailFadeFactor = 1.0; // Коэффициент затухания для каждого следующего слоя
  // const trailLayers: Layer[] = []; // Хранилище слоев шлейфа

  const updateAnimation = () => {
    if (!isAnimating) return;

    const hueLayerArrayData = composition.cutHue(originalImageData, currentHue);
    const hueLayer = new Layer(hueLayerArrayData);
    hueLayer.addHueNoize(0.2);
    hueLayer.setOpacity(1);

    // trailLayers.unshift(hueLayer);

    // if (trailLayers.length > maxTrailLength) {
    //   trailLayers.pop();
    // }

    // trailLayers.forEach((layer, index) => {
    //   // Чем старше слой, тем меньше opacity
    //   // Экспоненциальное затухание: opacity = baseOpacity * (fadeFactor ^ index)
    //   const opacity = Math.pow(1 - trailFadeFactor, index);
    //   layer.setOpacity(opacity);
    // });

    composition.clearLayers();

    // // TODO: шлейф для предыдущих слоев
    // for (let i = trailLayers.length - 1; i >= 0; i--) {
    //   composition.addLayer(trailLayers[i]);
    // }

    composition.addLayer(hueLayer);
    composition.render();

    currentHue = (currentHue + hueStep) % 360;
    animationFrameId = requestAnimationFrame(updateAnimation);
  };

  animationFrameId = requestAnimationFrame(updateAnimation);

  const whiteLayer = new Layer(originalImageData.map(() => 255));
  composition.addLayer(whiteLayer);

  const opacityLayer = new Layer(originalImageData);
  opacityLayer.setOpacity(0.2);
  composition.addLayer(opacityLayer);
  composition.render();
};
