import { translateTransform } from "../transformations";
import { TransformType } from "../classes";
import { rotateTransform } from "../transformations";
import { scaleTransform } from "../transformations";
import type { Layer } from "../classes";

export const transformedLayersMapper = (
  layer: Layer,
  width: number,
  height: number,
) => {
  if (!layer.options?.transform) return layer;
  const { x, y, alpha, scaleX, scaleY } = layer.options.transform;

  switch (layer.options?.transform.type) {
    case TransformType.Translate:
      const transformedData = translateTransform(
        layer.data,
        width,
        height,
        x,
        y,
      );
      layer.setData(transformedData);

      return layer;
    case TransformType.Rotate:
      const rotatedLayerData = rotateTransform(
        layer.data,
        width,
        height,
        alpha,
      );
      layer.setData(rotatedLayerData);

      return layer;
    case TransformType.Scale:
      const scaledLayerData = scaleTransform(
        layer.data,
        width,
        height,
        scaleX,
        scaleY,
      );
      layer.setData(scaledLayerData);

      return layer;
    default:
      return layer;
  }
};
