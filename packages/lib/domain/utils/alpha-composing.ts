export const alphaComposing = (
  fgColor: number,
  fgAlpha: number,
  bgColor: number,
  bgAlpha: number,
  resultAlpha: number,
): number => {
  return (fgColor * fgAlpha + bgColor * bgAlpha * (1 - fgAlpha)) / resultAlpha;
};
