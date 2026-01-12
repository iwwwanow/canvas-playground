import { translateTransform } from "../transformations";
import { TransformType } from "../classes";
import type { Layer } from "../classes";

export const transformedLayersMapper = (
  layer: Layer,
  width: number,
  height: number,
) => {
  if (!layer.options?.transform) return layer;
  const { x, y } = layer.options.transform;

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
    default:
      return layer;
  }
};
