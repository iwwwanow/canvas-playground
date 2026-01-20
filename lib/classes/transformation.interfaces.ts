export enum TransformType {
  Translate = "translate",
  Rotate = "rotate",
  Scale = "scale",
  Skew = "skew",
}

interface TranslateParams {
  alpha: number;
}

interface RotateParams {
  alpha: number;
}

interface ScaleParams {
  scaleX: number;
  scaleY: number;
}

interface SkewParams {
  scaleX: number;
  scaleY: number;
}

export interface TransformParams {
  [TransformType.Translate]: TranslateParams;
  [TransformType.Rotate]: RotateParams;
  [TransformType.Scale]: ScaleParams;
  [TransformType.Skew]: SkewParams;
}
