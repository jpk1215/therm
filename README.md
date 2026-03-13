# Therm

Therm provides display and control interfaces for campaign fundraising state, with separate static and production deployment targets.

## Repository Structure

- `index.html`: static client suitable for GitHub Pages.
- `robust/`: production application with serverless API routes, Firebase-backed persistence, and the local agent-testing harness.

## Deployment Targets

- **Static preview**: GitHub Pages  
  `https://jpk1215.github.io/therm/`
- **Production**: Vercel with `robust/` configured as the project root.

## Interface Usage

All routes below assume the deployed `robust/` base URL.

- **Display interface**  
  Use the default route or explicit query parameters:  
  `/`  
  `/?mode=display&campaign=default`

- **Control interface**  
  Open control mode with campaign and admin token:  
  `/?mode=control&campaign=default&token=YOUR_ADMIN_WRITE_TOKEN`

- **Token handling**  
  On first load, the client stores `token` in `localStorage` and removes it from the URL.  
  Subsequent control updates use the stored token for `POST /api/state` authorization.

## Production Architecture (`robust/`)

- Read access is served to clients via `GET /api/state`.
- State updates flow through `POST /api/state` and require an admin token.
- Firebase Admin credentials are sourced from environment variables and never committed.
- Realtime Database rules should block direct browser writes.

## Deployment Runbook

Follow `robust/README.md` for operational setup:

1. Firebase project and Realtime Database provisioning
2. Environment variable configuration
3. Vercel project import and deploy

## Local Development And Testing

All local app and automation commands live under `robust/`.

- App runtime and deployment details: `robust/README.md`
- Deterministic agent/testing workflow: `robust/AGENT_TESTING.md`
