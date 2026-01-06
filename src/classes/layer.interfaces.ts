import type { BlendMod } from "./composition.interfaces";

export enum TransformType {
  Translate = "translate",
}

export interface LayerOptions {
  name?: string;
  position?: string;
  blendMod?: BlendMod;
  opacity?: number;
  transform?: {
    type: TransformType;
    x: number;
    y: number;
  };
}
