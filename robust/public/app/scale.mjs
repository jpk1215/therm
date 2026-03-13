export function niceStep(rawStep) {
  const safeStep = Math.max(1, rawStep);
  const magnitude = 10 ** Math.floor(Math.log10(safeStep));
  const normalized = safeStep / magnitude;

  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function getScaleValues(maxValue) {
  const maxLabels = 9;
  const maxIntervals = maxLabels - 1;
  const step = niceStep(maxValue / maxIntervals);

  const values = [0];
  for (let value = step; value < maxValue; value += step) {
    values.push(value);
  }

  const lastValue = values[values.length - 1];
  const remainder = maxValue - lastValue;

  if (remainder === 0) {
    return values;
  }

  if (remainder < step * 0.65 && values.length > 1) {
    values[values.length - 1] = maxValue;
  } else {
    values.push(maxValue);
  }

  return values;
}
