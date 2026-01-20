import { TransformType } from "./transformation.interfaces";
import type { TransformParams } from "./transformation.interfaces";

export class Transformation<T extends TransformType> {
  type: T;
  params: TransformParams[T];

  constructor(type: T, params: TransformParams[T]) {
    this.type = type;
    this.params = params;
  }
}
