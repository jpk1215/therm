import test from "node:test";
import assert from "node:assert/strict";

import { getStateKey, normalizeState, toNonNegativeNumber, toPositiveNumber } from "../../public/app/state-utils.mjs";

test("positive and non-negative parsing fall back safely", () => {
  assert.equal(toPositiveNumber("12", 5), 12);
  assert.equal(toPositiveNumber("0", 5), 5);
  assert.equal(toNonNegativeNumber("-1", 4), 4);
  assert.equal(toNonNegativeNumber("7", 4), 7);
});

test("normalizeState clamps current value to max", () => {
  assert.deepEqual(
    normalizeState({
      maxValue: 1000,
      incrementValue: 250,
      currentValue: 1250
    }),
    {
      maxValue: 1000,
      incrementValue: 250,
      currentValue: 1000
    }
  );
});

test("normalizeState restores defaults for invalid values", () => {
  assert.deepEqual(
    normalizeState({
      maxValue: "nope",
      incrementValue: 0,
      currentValue: -5
    }),
    {
      maxValue: 100000,
      incrementValue: 10000,
      currentValue: 1250
    }
  );
});

test("getStateKey normalizes before building a comparison key", () => {
  assert.equal(
    getStateKey({
      maxValue: 1000,
      incrementValue: 250,
      currentValue: 1500
    }),
    "1000:250:1000"
  );
});
