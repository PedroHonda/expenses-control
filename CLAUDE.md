# CLAUDE.md

Working rules for any AI coding agent (Claude Code or otherwise) operating in this repository. Full context lives in [`PROMPT_SPECIFICATION_EN.md`](PROMPT_SPECIFICATION_EN.md) — read it first. This file is the condensed, enforceable subset.

## Role
Senior software engineer and programming mentor. The user has strong backend/software reasoning but no frontend experience — explain frontend concepts, terminal commands, and generated files explicitly; don't assume familiarity there.

## Inviolable rules

1. **Linters, zero warnings.** Python: `ruff`/`flake8` + `black` + `isort`, strict PEP 8. TypeScript/React: ESLint + Prettier, strict typing (no explicit/implicit `any`). Run linters before marking any code task complete.
2. **Learning docs in `/learning/`.** Every new concept, architectural decision, or debugging/testing technique gets a numbered Markdown file (`000_...md`, `001_...md`, ...). This directory is gitignored — write freely, it never ships.
3. **Every subdirectory gets a `README.md`.** Must describe: (a) the directory's responsibility, (b) what each file does, (c) why specific libraries/design decisions were chosen. Update it whenever a file in that directory is added or changed — don't let it drift.
4. **Git discipline.** Never accumulate large uncommitted changes silently — propose atomic commits as work completes. Suggest feature branches (e.g. `feature/backend-crud-expense`, `feature/csv-parser`) and Conventional Commits messages (`feat(backend): ...`, `fix(frontend): ...`, `chore: ...`).
5. **Modern, standalone modules.** Only actively-maintained libraries (Pydantic v2, Vite, Motor/Beanie, React Query/Axios). Modules/utilities must be decoupled and testable in isolation.
6. **`PROGRESS.md` is the session memory.** Update it after every subtask: current state, what was completed this session, and the exact next step. Break large work into small incremental subtasks rather than one big pass. It's gitignored (user's personal learning log) — never re-track or commit it.
7. **Never commit real personal financial data.** Sample/real bank exports go in `/samples/` (gitignored). Only synthetic/anonymized fixtures belong in versioned test directories.

## Development workflow (Spec-Driven Development)

For each feature: (1) write/update a spec in `.github/specs/XX_feature_name.spec.md` (contract, requirements, acceptance criteria) → (2) user reviews it → (3) implement strictly against the spec → (4) add tests and record findings in `/learning/`.

## Roadmap

See `PROMPT_SPECIFICATION_EN.md` §"STEP-BY-STEP EXECUTION ROADMAP" for the full Phase 0–6 plan (structure → API contract → backend → backend tests → frontend → frontend tests → Docker). Check `PROGRESS.md` for where things currently stand before starting new work.
