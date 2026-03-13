# Agent Testing Loop

This app now supports a deterministic, agent-oriented local test loop for repeated improvement work.

## Authoritative Commands

- `npm run setup:agent`
  - Prepares the agent environment, creates run directories, and installs the Playwright Chromium browser.
- `npm run dev`
  - Starts the local app against the default backend mode.
- `npm run dev:test`
  - Starts the local app in in-memory test mode with the reset and fault APIs enabled.
- `npm run check`
  - Runs lightweight syntax checks across the server and browser modules.
- `npm run test:unit`
  - Runs the unit suite and emits TAP-compatible output.
- `npm run test:smoke`
  - Runs the blocking Playwright smoke/behavior suite.
- `npm run test:visual`
  - Runs the opt-in Playwright visual regression lane.
- `npm run test:e2e:spec -- tests/e2e/thermometer.spec.js`
  - Reruns one or more smoke specs directly.
- `npm run test:e2e:grep -- --grep "control mode updates are reflected in display mode"`
  - Reruns smoke tests by title pattern.
- `npm run test:unit:file -- tests/unit/dev-server-api.test.mjs`
  - Reruns one or more unit test files.
- `npm run test:failed`
  - Reads the latest agent-run summary and reruns the most relevant failing lane/spec.
- `npm run test:agent-loop`
  - Runs the quick blocking loop: `check`, `unit`, and smoke e2e.
- `npm run test:agent-loop:full`
  - Runs the full loop: `check`, `unit`, smoke e2e, then visual regression.

## Reliability Contract

1. The local server in [`scripts/dev-server.js`](scripts/dev-server.js) serves [`public/index.html`](public/index.html) and implements `/api/state`.
2. Agent-run scripts default to `THERM_STATE_MODE=memory`, `ALLOW_TEST_API=1`, and `ADMIN_WRITE_TOKEN=test-admin-token`.
3. Playwright does not reuse an already-running server during agent runs.
4. Smoke tests exclude visual assertions by default. Visual checks are a separate lane.
5. E2E tests seed isolated campaign state via `POST /api/test/reset?campaign=<name>`.
6. The dev server exposes `POST /api/test/fault` in test mode so recovery and retry behavior can be tested intentionally.

## Machine-Readable Outputs

Each agent loop writes structured output under `test-results/agent-runs/`.

- `latest-summary.json`
  - Canonical summary of the latest run, step status, duration, rerun hints, and logs.
- `latest-artifacts.json`
  - Canonical failure manifest with available Playwright reports and attachments.
- `<run-id>/summary.json`
  - Run-specific copy of the summary.
- `<run-id>/artifacts.json`
  - Run-specific copy of the failure manifest.
- `<run-id>/<step>/step.log`
  - Console log for a specific step.
- `<run-id>/<step>/report.json`
  - Playwright JSON report for a smoke or visual step.
- `<run-id>/<step>/report.xml`
  - Playwright JUnit report for a smoke or visual step.
- `<run-id>/<step>/html-report/`
  - Playwright HTML report for that step.
- `<run-id>/<step>/output/`
  - Trace, screenshot, and video artifacts retained by Playwright.

## Recommended Agent Workflow

### Quick loop

1. Run `npm run test:agent-loop`.
2. Read `test-results/agent-runs/latest-summary.json`.
3. If the run failed, read `test-results/agent-runs/latest-artifacts.json`.
4. Fix the smallest relevant source file.
5. Use `npm run test:failed` or a targeted rerun command.
6. Re-run `npm run test:agent-loop`.

### Full loop

Use `npm run test:agent-loop:full` when:
- changing display visuals
- modifying browser timing/retry logic
- updating screenshots or visual structure
- validating a branch before commit/deploy

## Cleanup Rules

- Safe to delete:
  - `test-results/`
  - `playwright-report/`
- Do not delete:
  - committed snapshot baselines under `tests/e2e/*-snapshots/`
- Agent loops should treat `test-results/agent-runs/latest-summary.json` and `latest-artifacts.json` as the current source of truth.

## Key Files for Future Agents

- [`public/index.html`](public/index.html): shipped UI shell and selectors
- [`public/styles/app.css`](public/styles/app.css): production stylesheet
- [`public/app/main.mjs`](public/app/main.mjs): thin browser entrypoint
- [`public/app/sync-controller.mjs`](public/app/sync-controller.mjs): polling, write sequencing, and failure recovery
- [`public/app/render.mjs`](public/app/render.mjs): DOM rendering for stats, ticks, and fill state
- [`scripts/dev-server.js`](scripts/dev-server.js): local server, health contract, and test-only fault injection
- [`scripts/run-agent-loop.mjs`](scripts/run-agent-loop.mjs): structured agent runner
- [`scripts/run-unit-tests.mjs`](scripts/run-unit-tests.mjs): unit test wrapper with file targeting
- [`scripts/test-failed.mjs`](scripts/test-failed.mjs): rerun helper for the latest failing lane
- [`playwright.config.js`](playwright.config.js): deterministic Playwright defaults
- [`tests/e2e/thermometer.spec.js`](tests/e2e/thermometer.spec.js): smoke and recovery coverage
- [`tests/e2e/thermometer.visual.spec.js`](tests/e2e/thermometer.visual.spec.js): visual regression lane

## Notes

- `THERM_STATE_MODE=memory` prevents tests from touching Firebase.
- `ALLOW_TEST_API=1` enables the reset and fault-injection endpoints.
- `ADMIN_WRITE_TOKEN=test-admin-token` is the default automation token used by the local test scripts.
- `.nvmrc` defines the expected Node version for deterministic agent runs.
