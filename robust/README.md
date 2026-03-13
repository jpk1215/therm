# Therm Robust App

`robust/` is the production deployment target for Therm. It serves the shipped browser UI, exposes the serverless state API, and keeps write credentials in environment variables instead of in client code.

## What Lives Here

- `public/index.html`: shipped control/display shell
- `public/styles/app.css`: production stylesheet
- `public/app/`: browser modules for campaign parsing, rendering, and live sync
- `api/state.js`: public read + authenticated write endpoint
- `api/test/reset.js`: test-only reset helper for deterministic local automation
- `lib/`: shared server-side state and campaign rules
- `scripts/dev-server.js`: local static/API server used by development and tests

## Runtime Model

- `GET /api/state?campaign=<id>` returns the normalized state for a campaign
- `POST /api/state?campaign=<id>` updates state and requires `x-admin-token`
- Campaign IDs are restricted to letters, numbers, `_`, and `-`
- Browser control mode stores a provided `token` in `localStorage`, removes it from the URL, and reuses it for later writes
- Production persistence lives in Firebase Realtime Database unless local memory mode is enabled

## Local Development

Install dependencies in `robust/`, then use one of the local server modes:

- `npm run dev`
  - Runs the app against the default backend mode
- `npm run dev:test`
  - Runs the app in memory mode with the reset and fault APIs enabled for deterministic testing

The dev server listens on `http://127.0.0.1:4173`.

## Local URLs

- Display: `http://127.0.0.1:4173/?mode=display&campaign=default`
- Control: `http://127.0.0.1:4173/?mode=control&campaign=default&token=YOUR_ADMIN_WRITE_TOKEN`

## Testing

The fast local commands are:

- `npm run check`
- `npm run test:unit`
- `npm run test:smoke`
- `npm run test:visual`
- `npm run test:agent-loop`
- `npm run test:agent-loop:full`

`AGENT_TESTING.md` is the deeper reference for structured runs, reruns, and machine-readable artifacts.

## Production Deployment

Vercel should be configured with `robust/` as the project root.

Required environment variables:

- `ADMIN_WRITE_TOKEN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`

Node is pinned via `.nvmrc` locally and `package.json` engines for hosted deploys.

## Firebase Rules

Browser clients should be able to read campaign state directly only through the server API, not through Firebase writes:

```json
{
  "rules": {
    "campaigns": {
      ".read": true,
      ".write": false
    }
  }
}
```
