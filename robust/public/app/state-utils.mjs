import { DEFAULT_STATE } from "./constants.mjs";

export function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed > 0 ? parsed : fallback;
}

export function toNonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed >= 0 ? parsed : fallback;
}

export function normalizeState(rawState, defaults = DEFAULT_STATE) {
  const maxValue = toPositiveNumber(rawState?.maxValue, defaults.maxValue);
  const incrementValue = toPositiveNumber(rawState?.incrementValue, defaults.incrementValue);
  const currentRaw = toNonNegativeNumber(rawState?.currentValue, defaults.currentValue);
  const currentValue = Math.min(currentRaw, maxValue);

  return {
    maxValue,
    incrementValue,
    currentValue
  };
}

export function getStateKey(rawState, defaults = DEFAULT_STATE) {
  const normalized = normalizeState(rawState, defaults);
  return `${normalized.maxValue}:${normalized.incrementValue}:${normalized.currentValue}`;
}
