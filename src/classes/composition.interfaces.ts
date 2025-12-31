export interface CompositionConstructor {
  canvasId: string;
  imgQuerySelector: string;
}

export enum Channel {
  Red = "red",
  Green = "green",
  Blue = "blue",
  Alpha = "alpha",
}
