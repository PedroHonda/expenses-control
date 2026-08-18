# Expense Tracker

A personal expense management application built as a hands-on learning platform for modern full-stack development.

## What this project does

Tracks personal expenses via CSV bank statement import or manual entry, with dynamic categories, optional trip tagging, and filtering/reporting over the data.

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Database | MongoDB |
| Backend | Python 3.11+ / FastAPI / Pydantic v2 / Beanie ODM (on PyMongo's native async driver) |
| Frontend | TypeScript + React (Vite) |
| Containerization | Docker & Docker Compose |
| Methodology | GitHub Spec-Driven Development (SDD) |

## Project Structure

```text
expenses-control/
├── .github/specs/   # Spec-Driven Development contract files
├── backend/         # FastAPI application
├── frontend/        # React / TypeScript application
├── docker/          # Dockerfiles and compose manifests
├── learning/        # Numbered learning notes (local-only, gitignored)
├── samples/         # Local sample data for parser validation (gitignored, never committed)
├── .gitignore
├── CLAUDE.md         # Working rules for the AI coding agent on this repo
└── README.md         # This file
```

A local, gitignored `PROGRESS.md` also exists at the repo root as a personal session-to-session log — not part of the tracked project structure above.

## Full specification

The complete project specification, domain requirements, and development roadmap live in [PROMPT_SPECIFICATION_EN.md](PROMPT_SPECIFICATION_EN.md).

## Getting started

### Option A: Docker Compose (whole stack, one command)
```bash
docker compose up --build
```
- Frontend: `http://localhost:8080`
- Backend API docs: `http://localhost:8000/docs`

See `docker/README.md` and `learning/008_docker_deploy_guide.md` for details.

### Option B: run backend and frontend separately (local dev, hot reload)

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash; use .venv\Scripts\activate on cmd/PowerShell
pip install -e ".[dev]"
cp .env.example .env            # adjust MONGODB_URI if needed
python -m scripts.seed_categories
uvicorn app.main:app --reload
```
Requires a running MongoDB instance (`MONGODB_URI` in `.env`, defaults to `mongodb://localhost:27017`). API docs at `http://localhost:8000/docs` once running. See `backend/README.md` for details.

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if needed
npm run dev
```
`http://localhost:5173`, hot module reload. Needs the backend running (Option B above, not Option A) to actually load data. See `frontend/README.md` for details.
