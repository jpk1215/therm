# Agent Testing Loop

This app now supports a deterministic local test loop intended for repeated agent-driven improvements.

## Commands

- `npm run dev`
  - Starts the local app against the default backend mode.
- `npm run dev:test`
  - Starts the local app in in-memory test mode with the reset API enabled.
- `npm run check`
  - Runs lightweight syntax checks across the server and browser modules.
- `npm run test`
  - Runs `check` plus the unit test suite.
- `npm run test:e2e`
  - Runs `check` and the Playwright smoke suite.
- `npm run test:agent-loop`
  - Runs the recommended agent sequence: `check`, `test:unit`, then `test:e2e`.

## How the test loop works

1. The local server in [`scripts/dev-server.js`](scripts/dev-server.js) serves [`public/index.html`](public/index.html) and implements `/api/state`.
2. In `dev:test` mode, state is stored in memory instead of Firebase.
3. Playwright tests seed known state via `POST /api/test/reset?campaign=<name>`.
4. Tests then open control and display pages, drive interactions, and assert visible output.

## Safe iteration workflow

1. Start from `npm run test:agent-loop`.
2. Inspect any Playwright artifacts in `test-results/` and `playwright-report/`.
3. Fix the smallest relevant source file.
4. Re-run `npm run test:agent-loop`.

## Key files for future agents

- [`public/index.html`](public/index.html): shipped UI shell and selectors
- [`public/app/main.mjs`](public/app/main.mjs): browser interaction logic
- [`public/app/scale.mjs`](public/app/scale.mjs): tick spacing logic
- [`api/state.js`](api/state.js): production serverless API entry
- [`api/test/reset.js`](api/test/reset.js): test reset endpoint
- [`lib/state-store.js`](lib/state-store.js): shared state backend
- [`tests/e2e/thermometer.spec.js`](tests/e2e/thermometer.spec.js): browser smoke coverage

## Notes

- `THERM_STATE_MODE=memory` prevents tests from touching Firebase.
- `ALLOW_TEST_API=1` enables the reset endpoint.
- `ADMIN_WRITE_TOKEN=test-admin-token` is the default automation token used by the local test scripts.
