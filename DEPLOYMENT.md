# Docker and Railway

Everything runs from **App**, the npm workspace root. All converted assets and Three.js are included. No database, account service, Python, original MU client directory, or persistent volume is required. Gameplay runs in the browser; the API currently supplies health and demo metadata.

## Docker locally

From App, run either configuration (Docker with Compose v2 required):

```sh
docker compose --profile combined up --build -d
```

Open http://localhost:8080. One container serves UI, assets and API. To stop:

```sh
docker compose --profile combined down
```

For separate UI and private API containers:

```sh
docker compose --profile split up --build -d
```

Open the same http://localhost:8080. Only the UI publishes a host port; `/api/*` is proxied to `http://server:8080`. Stop with `docker compose --profile split down`. Choose another host port with `DEMO_PORT=8082`. Do not run both profiles on the same host port.

Both services use the same multi-stage Dockerfile and non-root Node 24 image. The build installs locked dependencies, strictly type-checks and compiles the TypeScript packages/server, bundles the Vite UI, and runs tests; startup directly serves the existing build. `/healthz` is the container's local health check. `.env` and source conversion tools are excluded from the image.

## Railway: one service

1. Connect the repository containing App. If App is the repository root, leave Root Directory empty; if your repository contains an App subdirectory, set Root Directory to `/App` and the config file path to `/App/railway.json`.
2. Use the included `railway.json` and `Dockerfile`. Leave the start command override empty so Docker's CMD runs.
3. Leave `INTERNAL_API_URL` unset and `SERVE_UI=true` (image default). The image sets `HOST=::` and `NODE_ENV=production`; Railway supplies `PORT`.
4. Generate a public domain for this service. The domain's target port must match the service's PORT. Health check: `/healthz`.

## Railway: UI plus private server

Create two services from the same workspace root and Dockerfile, named `ui` and `server`. Both use the same `railway.json` health check. Set these runtime variables:

| Service | Variable         | Value                                                        |
| ------- | ---------------- | ------------------------------------------------------------ |
| server  | SERVE_UI         | false                                                        |
| server  | PORT             | 8080                                                         |
| ui      | SERVE_UI         | true                                                         |
| ui      | INTERNAL_API_URL | `http://${{server.RAILWAY_PRIVATE_DOMAIN}}:${{server.PORT}}` |

Generate a public domain **on ui**. The server uses Railway's private network. Keep both services in the same project/environment. Do not set INTERNAL_API_URL on the server, and never put the private hostname in browser code. The browser requests `/api` on the UI's public origin; the Node UI service makes the private request at runtime. Changing the internal address only requires restarting/redeploying the UI service, not rebuilding browser assets.

`HOST=::` accepts IPv4 and IPv6 traffic, including Railway private networking. HTTP internally and Railway-managed HTTPS publicly avoid browser mixed-content and CORS issues. Upstream failures return a controlled 502; `/healthz` checks the local process independently, while `/api/health` through the UI checks the actual API connection.

## Local environment

Copy `.env.example` to `.env` in App, edit it, and run `npm start`. Node 22.12+ is required; Node 24 is recommended and used by Docker. Run npm ci once before local commands. The server loads `.env`, preserving variables already supplied by the process/platform. Docker Compose sets its runtime variables explicitly; it does not inject the local-development `.env` into containers.

| Variable         | Purpose                                                              |
| ---------------- | -------------------------------------------------------------------- |
| PORT             | Listening port; defaults to 5173 locally, 8080 in Docker             |
| HOST             | Listening address; localhost locally, `::` in Docker                 |
| SERVE_UI         | `true` serves UI/API; `false` serves API only                        |
| INTERNAL_API_URL | Optional HTTP(S) API origin, UI service only; no path or credentials |
| NODE_ENV         | `production` serves built UI, `development` allows source serving    |
| DEMO_PORT        | Compose-only host port; defaults to 8080                             |

## Verify after deployment

```sh
curl --fail https://YOUR-UI-DOMAIN/healthz
curl --fail https://YOUR-UI-DOMAIN/api/health
curl --fail https://YOUR-UI-DOMAIN/api/demo
```

Open the public URL, select each hero, and start a run. Assets, music and skill sounds come from that same origin. No localhost URL is embedded in the shipped game. Local checks: `npm run check`.

References: [Railway private networking](https://docs.railway.com/networking/private-networking), [configuration as code](https://docs.railway.com/config-as-code/reference).
