const DEFAULT_STATE = {
  maxValue: 100000,
  incrementValue: 10000,
  currentValue: 1250
};

function normalizeNumber(value, fallback, min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed < min ? fallback : parsed;
}

function normalizeState(raw) {
  const maxValue = normalizeNumber(raw?.maxValue, DEFAULT_STATE.maxValue, 1);
  const incrementValue = normalizeNumber(raw?.incrementValue, DEFAULT_STATE.incrementValue, 1);
  const currentRaw = normalizeNumber(raw?.currentValue, DEFAULT_STATE.currentValue, 0);
  const currentValue = Math.min(currentRaw, maxValue);

  return {
    maxValue,
    incrementValue,
    currentValue
  };
}

module.exports = {
  DEFAULT_STATE,
  normalizeState
};
