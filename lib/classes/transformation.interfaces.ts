export enum TransformType {
  Translate = "translate",
  Rotate = "rotate",
  Scale = "scale",
  Skew = "skew",
}

interface TranslateParams {
  tx: number;
  ty: number;
}

interface RotateParams {
  alpha: number;
}

interface ScaleParams {
  scaleX: number;
  scaleY: number;
}

interface SkewParams {
  tx: number;
  ty: number;
}

export interface TransformParams {
  [TransformType.Translate]: TranslateParams;
  [TransformType.Rotate]: RotateParams;
  [TransformType.Scale]: ScaleParams;
  [TransformType.Skew]: SkewParams;
}
