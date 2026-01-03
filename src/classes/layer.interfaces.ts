import type { BlendMod } from "./composition.interfaces";

export interface LayerOptions {
  name?: string;
  position?: string;
  blendMod?: BlendMod;
  opacity?: number;
}
