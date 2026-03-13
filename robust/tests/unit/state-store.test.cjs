const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const stateStorePath = path.resolve(__dirname, "../../lib/state-store.js");

function loadStateStoreWithEnv(env) {
  const previous = {
    THERM_STATE_MODE: process.env.THERM_STATE_MODE,
    ALLOW_TEST_API: process.env.ALLOW_TEST_API
  };

  process.env.THERM_STATE_MODE = env.THERM_STATE_MODE;
  process.env.ALLOW_TEST_API = env.ALLOW_TEST_API;
  delete require.cache[stateStorePath];

  const stateStore = require(stateStorePath);

  return {
    stateStore,
    restore() {
      if (previous.THERM_STATE_MODE === undefined) {
        delete process.env.THERM_STATE_MODE;
      } else {
        process.env.THERM_STATE_MODE = previous.THERM_STATE_MODE;
      }

      if (previous.ALLOW_TEST_API === undefined) {
        delete process.env.ALLOW_TEST_API;
      } else {
        process.env.ALLOW_TEST_API = previous.ALLOW_TEST_API;
      }

      delete require.cache[stateStorePath];
    }
  };
}

test("memory mode persists normalized campaign state", async () => {
  const { stateStore, restore } = loadStateStoreWithEnv({
    THERM_STATE_MODE: "memory",
    ALLOW_TEST_API: "1"
  });

  try {
    const updated = await stateStore.setState("alpha", {
      maxValue: 5000,
      currentValue: 7000,
      incrementValue: 0
    });

    assert.deepEqual(updated, {
      maxValue: 5000,
      incrementValue: 10000,
      currentValue: 5000
    });

    const loaded = await stateStore.getState("alpha");
    assert.deepEqual(loaded, updated);
  } finally {
    restore();
  }
});

test("resetState replaces memory-backed state with defaults", async () => {
  const { stateStore, restore } = loadStateStoreWithEnv({
    THERM_STATE_MODE: "memory",
    ALLOW_TEST_API: "1"
  });

  try {
    await stateStore.setState("beta", {
      maxValue: 70000,
      currentValue: 25000,
      incrementValue: 5000
    });

    const reset = await stateStore.resetState("beta");
    assert.deepEqual(reset, {
      maxValue: 100000,
      incrementValue: 10000,
      currentValue: 1250
    });
  } finally {
    restore();
  }
});

test("test API is disabled outside memory mode unless explicitly enabled", async () => {
  const { stateStore, restore } = loadStateStoreWithEnv({
    THERM_STATE_MODE: "",
    ALLOW_TEST_API: ""
  });

  try {
    assert.equal(stateStore.canUseTestApi(), false);
  } finally {
    restore();
  }
});
