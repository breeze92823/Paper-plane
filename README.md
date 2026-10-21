# Paper-plane

## Deploy

`.github/workflows/deploy.yml` builds the client and uploads `dist/` to Bloxity hosting on
every push: `dev` → `dev` channel (`npm run build:dev`), `main` → `prod` channel (`npm run build`).

Repo settings (Settings → Secrets and variables → Actions):

- **Variable** `LEGION_GAME_ID` — the Bloxity game ID (= `GAME_SLUG` in `src/config.js`, `paper-plane`).
- **Secret** `LEGION_DEPLOY_TOKEN` — Bloxity deploy token.
- **Variables** `SERVER_URL_DEV` / `SERVER_URL_MAIN` — the backend's Legion `dev` / `prod`
  WebSocket URLs, baked in as `VITE_SERVER_URL_DEV` / `VITE_SERVER_URL_MAIN`. Unset means
  that build runs single-player.

The backend repo (`../Paper-plane-backend`) deploys through its own workflow.
