export const getResultAlpha = (
  bgNormalAlpha: number,
  fgNormalAlpha: number,
) => {
  const resultAlpha = fgNormalAlpha + bgNormalAlpha * (1 - fgNormalAlpha);
  return resultAlpha;
};
