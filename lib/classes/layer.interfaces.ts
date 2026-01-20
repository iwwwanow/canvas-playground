import type { BlendMod } from "./composition.interfaces";

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
    scaleX: number;
    scaleY: number;
  };
}

export interface SetTransformProps {
  type: TransformType;
  x?: number;
  y?: number;
  alpha?: number;
  scaleX?: number;
  scaleY?: number;
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
