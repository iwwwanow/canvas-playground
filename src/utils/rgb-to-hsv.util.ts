export const rgbToHsv = ([r, g, b]: [number, number, number]): [
  number,
  number,
  number,
] => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h: number,
    s: number,
    v: number = max;

  const d = max - min;

  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0; // Achromatic
  } else {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Scale h, s, v to the required ranges
  return [h * 360, s * 100, v * 100]; // HSV scale
};
