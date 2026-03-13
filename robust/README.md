# Robust Hosting Scaffold (No Secrets in Git)

This folder is a separate deployment target from GitHub Pages.

- Keep root `index.html` for GitHub Pages (simple static version).
- Use this `robust/` app for a production-style setup where write credentials stay in host environment variables.

## Recommended host

Use **Vercel** for this folder.

## Architecture

- Browser display/controller talks to `/api/state?campaign=default`.
- `GET /api/state` is public (read current values).
- `POST /api/state` requires `x-admin-token` header.
- Server writes to Firebase Realtime Database using Firebase Admin SDK from env vars.

## Folder structure

- `api/state.js`: serverless endpoint for reading/updating campaign state.
- `.env.example`: required env var names (copy to local `.env.local` only).
- `vercel.json`: function runtime config.

## Firebase setup

1. Create a Firebase project.
2. Enable **Realtime Database**.
3. In Firebase console, create a **service account key**:
   - Project settings -> Service accounts -> Generate new private key
4. Add those values to Vercel environment variables (do not commit):
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_DATABASE_URL`
   - `ADMIN_WRITE_TOKEN`

## Realtime Database rules (simple one-time event)

Use rules that allow reads from display clients but block direct writes from browser clients:

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

Writes then go only through your serverless `POST /api/state` route.

## Deploy on Vercel

1. Push this repo to GitHub (already done).
2. In Vercel, import repo and set **Root Directory** to `robust`.
3. Add all env vars from `.env.example`.
4. Deploy.

## Next implementation step

Create a `public/index.html` (or React app) inside `robust/` that:
- polls or subscribes to `/api/state` for display mode
- posts updates to `/api/state` with `x-admin-token` in control mode

This keeps Firebase admin credentials off the client and out of git history.
