export function niceStep(rawStep) {
  const safeStep = Math.max(1, rawStep);
  const magnitude = 10 ** Math.floor(Math.log10(safeStep));
  const normalized = safeStep / magnitude;

  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function resolveStep(maxValue, preferredStep) {
  const autoStep = niceStep(maxValue / 8);
  if (!Number.isFinite(preferredStep) || preferredStep <= 0) {
    return autoStep;
  }

  let step = niceStep(preferredStep);
  while ((Math.ceil(maxValue / step) + 1) > 12) {
    step = niceStep(step * 1.5);
  }

  return step;
}

export function getScaleValues(maxValue, preferredStep) {
  const step = resolveStep(maxValue, preferredStep);

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
