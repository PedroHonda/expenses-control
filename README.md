# Expense Tracker

A personal expense management application built as a hands-on learning platform for modern full-stack development.

## What this project does

Tracks personal expenses via CSV bank statement import or manual entry, with dynamic categories, optional trip tagging, and filtering/reporting over the data.

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Database | MongoDB |
| Backend | Python 3.11+ / FastAPI / Pydantic v2 / Motor (Beanie ODM) |
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

Setup instructions will be added as the backend and frontend are scaffolded (Phase 2 and Phase 4 of the roadmap).
