// TODO: how to detalize?
export type ColorValue = number;
// TODO: how to limit an 255 value?
export type RgbaArray = [ColorValue, ColorValue, ColorValue, ColorValue];
export type RgbArray = [ColorValue, ColorValue, ColorValue];
// TODO: how to detalize it?
export type HexString = string;

export type HueValue = number;
export type SaturationValue = number;
export type ValueValue = number;
export type LightnessValue = number;

export type HsvArray = [HueValue, SaturationValue, ValueValue];
export type HslArray = [HueValue, SaturationValue, LightnessValue];
