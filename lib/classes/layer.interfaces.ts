import type { BlendMod } from "./composition.interfaces";

export enum TransformType {
  Translate = "translate",
  Rotate = "rotate",
}

export interface LayerOptions {
  name?: string;
  position?: string;
  blendMod?: BlendMod;
  opacity?: number;
  transform?: {
    type: TransformType;
    x?: number;
    y?: number;
    alpha?: number;
  };
}

export interface SetTransformProps {
  type: TransformType;
  x?: number;
  y?: number;
  alpha?: number;
}

export enum LayerEffect {
  Noize = "noize",
}

export interface NoizeEffectOptions {
  deviationCoefficient: number;
  preserveAlpha: boolean;
}

export interface LayerEffectOptions {
  [LayerEffect.Noize]: NoizeEffectOptions;
}
