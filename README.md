# Thermometer Hosting Layout

This repo now supports two paths:

- `index.html` at repo root: simple static page for GitHub Pages.
- `robust/`: separate app scaffold for a more secure hosted setup that uses environment variables and avoids committing secrets.

## Which host to use

For the robust app, use **Vercel**.

Why:
- quick deploy from GitHub
- easy environment variable management
- serverless API routes for write protection

## Current GitHub Pages URL

`https://jpk1215.github.io/therm/`

## Next step

Open `robust/README.md` and follow:
1. Firebase project setup
2. secret/env setup
3. Vercel deploy
