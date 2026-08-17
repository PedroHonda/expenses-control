# `docker/`

## Responsibility
Containerization manifests: multi-stage Dockerfiles for the backend and frontend, and the `docker-compose.yml` orchestrating MongoDB + backend + frontend for local/cloud deployment.

## Contents
Empty as of Phase 0. Populated in Phase 6, after the backend and frontend applications exist to containerize.

## Why this approach
Multi-stage builds keep final images small (build deps excluded from the runtime image). Compose orchestration keeps the three services (db, api, web) reproducible for local development without manually managing each process.
