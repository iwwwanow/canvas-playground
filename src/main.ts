import { Composition } from "./composition.class";

const CANVAS_ID = "channels-canvas";
const IMAGE_SRC = "assets/flowers.jpg";

const bootstrap = () => {
  const composition = new Composition({
    canvasId: CANVAS_ID,
    imageSrc: IMAGE_SRC,
  });
  composition.init();
};

bootstrap();
