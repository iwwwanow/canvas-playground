import type { Layer } from "../classes";
import { TransformType } from "../classes";
import { Transformation } from "../classes";

import { translateTransform } from "../transformations";
import { rotateTransform } from "../transformations";
import { scaleTransform } from "../transformations";
import { skewTransform } from "../transformations";

export const transformedLayersMapper = (
  layer: Layer,
  width: number,
  height: number,
) => {
  if (!layer.options?.transform) return layer;
  const { x, y, alpha, scaleX, scaleY } = layer.options.transform;
  const transformType = layer.options?.transform.type;

  const transformation = new Transformation(transformType);

  // switch (transformType) {
  //   case TransformType.Translate:
  //     const transformedData = translateTransform(
  //       layer.data,
  //       width,
  //       height,
  //       x,
  //       y,
  //     );
  //     layer.setData(transformedData);
  //
  //     return layer;
  //   case TransformType.Rotate:
  //     const rotatedLayerData = rotateTransform(
  //       layer.data,
  //       width,
  //       height,
  //       alpha,
  //     );
  //     layer.setData(rotatedLayerData);
  //
  //     return layer;
  //   case TransformType.Scale:
  //     const scaledLayerData = scaleTransform(
  //       layer.data,
  //       width,
  //       height,
  //       scaleX,
  //       scaleY,
  //     );
  //     layer.setData(scaledLayerData);
  //
  //     return layer;
  //   case TransformType.Skew:
  //     const shearedLayerData = skewTransform(layer.data, width, height, x, y);
  //     layer.setData(shearedLayerData);
  //
  //     return layer;
  //   default:
  //     return layer;
  // }
};
