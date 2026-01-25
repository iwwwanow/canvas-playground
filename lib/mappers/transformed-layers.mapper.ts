import type { Layer } from "../classes";
import { Transformation } from "../classes";

// TODO: поднять это на уровень выше

export const transformedLayersMapper = (
  layer: Layer,
  width: number,
  height: number,
) => {
  if (!layer.options?.transform?.type) return layer;
  const { type, params } = layer.options.transform;

  const transformation = new Transformation(type, params);

  const processedData = transformation.process(layer.data, width, height);
  layer.setData(processedData);
  return layer;
};
