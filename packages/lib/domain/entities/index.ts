export { Composition } from "./composition";
export { Color } from "./color";
// Layer is never constructed outside Composition (createLayerFromPixelData /
// createBlankLayer / createColorLayer / duplicateLayer) — exported as a type
// only, so consumers can annotate a value they received but not `new` one.
export type { Layer } from "./layer";
