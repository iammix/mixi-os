# Railway deployment

The `mixi-os` Railway service deploys `iammix/mixi-os` from `main`.

- Live app: https://mixi-os-production.up.railway.app
- Railway project: https://railway.com/project/55aa310c-5165-4003-b702-02583dd6d2cc
- CI runs: https://github.com/iammix/mixi-os/actions/workflows/ci.yml

1. Push a commit to `main` (or merge a pull request).
2. GitHub Actions runs `npm ci` and `npm run build -- --base=/` on Node.js 22.
3. Railway's GitHub integration waits for CI to pass, builds the same commit,
   and serves `dist` with Railpack's Caddy static server and SPA fallback.
4. Railway checks `/` before switching traffic to the new deployment.

Pull requests run the build check without deploying production. A failed build
keeps the previous deployment running. No Railway token is needed in GitHub.

The Railway service has `RAILPACK_NODE_VERSION=22` and
`RAILPACK_SPA_OUTPUT_DIR=dist`. Its settings in Railway are:

- Builder: Railpack
- Build command: `npm run build -- --base=/`
- Healthcheck: `/`, timeout 60 seconds
- Restart policy: on failure, up to 3 retries
- Source: `iammix/mixi-os`, branch `main`, Wait for CI enabled

These settings live on the Railway service. The repository does not use the
deprecated `railway.json` configuration format.

Railway builds at `/` so asset URLs and React Router work on its domain. The
existing GitHub Pages build scripts still use the `/mixi-os/` base configured
in `vite.config.ts`.

To validate the Railway build locally:

```sh
npm ci
npm run build -- --base=/
```

`npm run build` includes TypeScript checking. Lint is not a deployment gate yet:
the existing application has lint errors that need a separate cleanup.

For a rollback, redeploy a previous successful deployment in Railway. To move
`mixiosk.com`, attach that custom domain to the service and update its DNS using
the records Railway supplies.

## Training API (Garmin)

The cork board in the room shows this month's swim, bike and run from Garmin
Connect. The Garmin key can't live in the static site, so a second Railway
service runs `server/` (plain Node 22, no dependencies, `npm start`) and returns
only the month's totals:

- `GET /training/month` → `{ month, updated, swim, bike, run }`, each
  `{ km, seconds, sessions }`, cached for 15 minutes
- `GET /health` → `ok`

The service is `training-api` in the same Railway project, at
https://training-api-production-eacd47fb.up.railway.app. Its settings:

- Source: `iammix/mixi-os`, branch `main`, root directory `/server`,
  start command `node index.mjs`
- `PORT=8787` (the port its domain routes to) and `RAILPACK_NODE_VERSION=22`
- Variables: `GARMIN_API_KEY` (Garmin Connect → Settings → Personal API Key),
  optionally `TRAINING_TIME_ZONE` (default `Europe/Amsterdam`) and
  `CACHE_MINUTES` (default 15)
- Healthcheck: `/health`

The site's service needs `VITE_TRAINING_API_URL` set to the API's public URL
(no trailing slash) so the build points the board at it. Without it, the board
says "not hooked up yet". `?training=demo` shows made-up numbers.

To run it locally:

```sh
GARMIN_API_KEY=… node server/index.mjs          # listens on :8787
VITE_TRAINING_API_URL=http://localhost:8787 npm run dev
```
