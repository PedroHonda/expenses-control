# `docker/`

## Responsibility
Multi-stage Dockerfiles for the backend and frontend. Orchestration (`docker-compose.yml`) lives at the repo root — Docker Compose expects to be run from the directory it's in, and keeping it there means `docker compose up` just works from the repo root without extra flags.

## Files
- **`backend.Dockerfile`** — two stages: `builder` (installs the app + its runtime dependencies into a venv via `pip install .`) and `runtime` (slim, non-root, no compiler/pip-cache/dev-tooling). Runs the idempotent category seeder on every container start before starting `uvicorn`.
- **`frontend.Dockerfile`** — two stages: `builder` (`node:24-alpine`, `npm ci` + `npm run build`) and `runtime` (`nginx:alpine` serving the static build — no Node in the final image at all). `frontend/nginx.conf` (not here — see below) configures SPA-fallback routing and long-cache headers for fingerprinted assets.

## Why the Dockerfiles live here but `nginx.conf` doesn't

Each Dockerfile's **build context** is its own service directory (`backend/`, `frontend/`) — so each service's `.dockerignore` applies correctly, and neither build context is bloated with the other service's files or repo-level clutter (`learning/`, `samples/`, etc.). Docker supports the Dockerfile itself living outside its build context (that's what `dockerfile: ../docker/....Dockerfile` in `docker-compose.yml` does), but a `COPY` instruction's *source* path can never reach outside the build context — so `nginx.conf`, which `frontend.Dockerfile`'s runtime stage needs to `COPY`, has to physically live inside `frontend/`, not here.

## Usage
From the repo root:
```bash
docker desktop start   # only needed if Docker Desktop isn't already running
docker compose up -d
```
`docker desktop start` (a Docker Desktop CLI command, not a compose thing) waits until the engine is actually ready and is a no-op if it's already running — without it, a fresh terminal after a reboot gets `failed to connect to the docker API` until Docker Desktop is opened some other way, since it doesn't start on login by default. Skip it entirely by enabling **Docker Desktop → Settings → General → "Start Docker Desktop when you log in"**.
- Frontend: `http://localhost:8080`
- Backend API docs: `http://localhost:8000/docs`
- MongoDB: `localhost:27017` (exposed for local inspection with Compass/`mongosh`, not required for the app itself)

Verified working end-to-end (all three services healthy, app fully functional at `:8080`). See `../learning/008_docker_deploy_guide.md` for a full walkthrough, including two real bugs that first run surfaced (an SSL-verification workaround needed on this machine, and a `localhost`-vs-`127.0.0.1` healthcheck fix) and what's still missing for a real (non-localhost) deployment.

## Why multi-stage builds
Keeps the final runtime images small and low-attack-surface: the backend's runtime image never contains a C compiler or pip's download cache, and the frontend's runtime image never contains Node or `node_modules` at all — only the static files nginx serves. Compose orchestration keeps the three services (db, api, web) reproducible for local development without manually managing each process, and gives each one a healthcheck so `depends_on` waits for actual readiness, not just "the container started."
