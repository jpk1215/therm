import test from "node:test";
import assert from "node:assert/strict";

import { formatMoney } from "../../public/app/format.mjs";

test("formatMoney uses whole-dollar currency formatting", () => {
  assert.equal(formatMoney(0, "en-US"), "$0");
  assert.equal(formatMoney(1750000, "en-US"), "$1,750,000");
});
