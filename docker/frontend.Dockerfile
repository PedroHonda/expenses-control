# syntax=docker/dockerfile:1
#
# Build context is frontend/, Dockerfile lives outside it in docker/ --
# Docker allows that split (context governs what COPY can see; the
# Dockerfile's own location is independent of it):
#   docker build -f docker/frontend.Dockerfile -t expense-tracker-frontend frontend
# (docker-compose.yml wires this up automatically -- see ../docker-compose.yml)

# ---- builder: npm ci + vite build ----
FROM node:24-alpine AS builder

WORKDIR /app

# Dependency files copied (and installed) before the rest of the source,
# so Docker's layer cache only re-runs `npm ci` when package*.json
# actually changed -- not on every source edit. (The backend Dockerfile
# can't get this same separation as cleanly; see its comments.)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked into the built JS bundle at build time (Vite inlines
# import.meta.env.VITE_* at build, not at container start) -- the value
# must be reachable from the *browser*, not from inside the Docker
# network, since this is a static SPA the browser fetches from.
ARG VITE_API_BASE_URL=http://localhost:8000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---- runtime: static files served by nginx, no Node at all ----
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
# nginx.conf lives in frontend/ (not docker/, alongside the other
# Dockerfiles) specifically because COPY's source path must be inside the
# build context (frontend/) -- Docker never allows reaching outside it,
# unlike the Dockerfile's own location.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD wget --quiet --spider http://localhost/ || exit 1
