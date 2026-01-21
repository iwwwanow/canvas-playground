import { TransformType } from "./transformation.interfaces";
import type { TransformParams } from "./transformation.interfaces";
import { Matrix } from "../math";

export class Transformation<T extends TransformType> {
  type: T;
  params: TransformParams[T];
  affineMatrix: Matrix;

  constructor(type: T, params: TransformParams[T]) {
    this.type = type;
    this.params = params;

    // TODO: тождественная матрица?
    this.affineMatrix = new Matrix(3, 3, [1, 1, 1, 1, 1, 1, 1, 1, 1]);

    this.setAffineMatrix(type);
  }

  private setAffineMatrix(type: TransformType) {
    let params;

    switch (type) {
      case TransformType.Skew:
        params = this.params as TransformParams[TransformType.Skew];
        this.affineMatrix = this.getSkewMatrix(params.tx, params.ty);
        break;
      case TransformType.Scale:
        params = this.params as TransformParams[TransformType.Scale];
        this.affineMatrix = this.getScaleMatrix(params.scaleX, params.scaleY);
        break;
      case TransformType.Rotate:
        params = this.params as TransformParams[TransformType.Rotate];
        const radians = (Math.PI / 180) * params.alpha;
        this.affineMatrix = this.getRotateMatrix(radians);
        break;
      case TransformType.Translate:
        params = this.params as TransformParams[TransformType.Translate];
        this.affineMatrix = this.getTranslateMatrix(params.tx, params.ty);
        break;
      default:
        throw new Error("transform type incorrect");
    }
  }

  private getSkewMatrix(tx: number, ty: number): Matrix {
    return new Matrix(3, 3, [1, tx, 0, ty, 1, 0, 0, 0, 1]);
  }

  private getScaleMatrix(scaleX: number, scaleY: number): Matrix {
    return new Matrix(3, 3, [scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1]);
  }

  private getRotateMatrix(radians: number): Matrix {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Matrix(3, 3, [cos, -sin, 0, sin, cos, 0, 0, 0, 1]);
  }

  private getTranslateMatrix(tx: number, ty: number): Matrix {
    return new Matrix(3, 3, [1, 0, 0, 0, 1, 0, tx, ty, 1]);
  }
}
