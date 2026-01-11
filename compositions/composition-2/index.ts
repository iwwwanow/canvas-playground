import { Composition } from "../../lib";
import { Layer } from "../../lib";

const CANVAS_ID = "canvas-2";
const IMG_QUERY_SELECTOR = "#source-2";

const drawPoppies2 = () => {
  const composition = new Composition({
    canvasId: CANVAS_ID,
    imgQuerySelector: IMG_QUERY_SELECTOR,
  });

  composition.init();

  const originalImageData = composition.imageData?.data;
  if (!originalImageData) throw new Error("image data not defined");

  let currentHue = 0;
  const hueStep = 1;
  let animationFrameId: number | null = null;
  let isAnimating = false;

  const updateAnimation = () => {
    if (!isAnimating) return;

    const hueLayerArrayData = composition.cutHue(originalImageData, currentHue);
    const hueLayer = new Layer(hueLayerArrayData);
    hueLayer.addHueNoize(0.2);

    composition.clearLayers();
    // TODO: шлейф для предыдущих слоев
    composition.addLayer(hueLayer);
    composition.render();

    currentHue = (currentHue + hueStep) % 360;
    animationFrameId = requestAnimationFrame(updateAnimation);
  };

  animationFrameId = requestAnimationFrame(updateAnimation);
};

drawPoppies2();
