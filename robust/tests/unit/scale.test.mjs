import test from "node:test";
import assert from "node:assert/strict";

import { getScaleValues, niceStep } from "../../public/app/scale.mjs";

test("niceStep rounds to readable milestones", () => {
  assert.equal(niceStep(9300), 10000);
  assert.equal(niceStep(21000), 50000);
  assert.equal(niceStep(1400), 2000);
});

test("getScaleValues avoids cramped near-duplicate top labels", () => {
  assert.deepEqual(getScaleValues(75000), [
    0,
    10000,
    20000,
    30000,
    40000,
    50000,
    60000,
    75000
  ]);
});

test("getScaleValues preserves exact evenly spaced top value", () => {
  assert.deepEqual(getScaleValues(100000), [
    0,
    20000,
    40000,
    60000,
    80000,
    100000
  ]);
});

test("getScaleValues honors a practical preferred increment", () => {
  assert.deepEqual(getScaleValues(100000, 10000), [
    0,
    10000,
    20000,
    30000,
    40000,
    50000,
    60000,
    70000,
    80000,
    90000,
    100000
  ]);
});

test("getScaleValues increases tiny preferred increments to avoid overcrowding", () => {
  assert.deepEqual(getScaleValues(100000, 1000), [
    0,
    10000,
    20000,
    30000,
    40000,
    50000,
    60000,
    70000,
    80000,
    90000,
    100000
  ]);
});
