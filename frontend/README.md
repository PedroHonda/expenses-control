# `frontend/`

## Responsibility

The TypeScript + React (Vite) single-page app: expense entry form, CSV upload/review table, expense table, and summary/filter views. Consumes the backend API defined in `.github/specs/01_api_contract.spec.md`.

## Contents

- Scaffolded with `npx create-vite@latest frontend --template react-ts --eslint` (Phase 4). See `../learning/004_vite_react_project_structure.md` for a guided walkthrough of every generated file, aimed at a backend-experienced, frontend-new reader.
- `src/` — application source. Structure grows as components are added; each new subdirectory under `src/` gets its own `README.md` per project Rule 3.

## Setup

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, hot module reload
npm run lint      # ESLint, must be zero warnings (Rule 1)
npm run test      # Vitest, single run
npm run test:watch  # Vitest, watch mode
npm run build     # type-checks (tsc -b) then produces dist/
```

Needs the backend running (see `../backend/README.md`) for any feature that calls the API.

## Why these choices

- **Vite**: fast dev server (native ESM, no bundling in dev) and minimal config compared to older tooling (CRA, plain Webpack).
- **TypeScript, `strict: true`**: catches integration errors against the backend's Pydantic-defined API contract at compile time rather than at runtime. Both `tsconfig.app.json` and `tsconfig.node.json` explicitly set `"strict": true` — the Vite template doesn't turn this on by default, and project Rule 1 requires it.
- **ESLint with `strictTypeChecked` + `stylisticTypeChecked`** (not just `recommended`): Vite's own generated docs recommend this upgrade "for a production application" — it uses real type information (via the `tsconfig` files wired into `languageOptions.parserOptions`) to catch things like implicit `any` that syntax-only linting can't see.
- **React**: component model fits the planned UI (form, dropzone + review table, expense table, summary cards) well, and has the largest ecosystem for a learner to find resources in.
- **Vitest + React Testing Library** (not Jest): Vitest reuses this project's existing Vite config and transform pipeline directly (no separate Babel/ts-jest setup to keep in sync), and runs noticeably faster on this codebase. React Testing Library's philosophy — query by role/label/text, the way a user would find things, not by internal component structure — is what keeps `src/components/*.test.tsx` resilient to refactors that don't change actual behavior.
- **Recharts** (added for `ReportsView`, spec 06): the only actively-maintained charting library already idiomatic for React (declarative `<BarChart>`/`<Bar>` components, not an imperative canvas API to wrap). Its `Cell` component is deprecated as of the installed v3 in favor of a `shape` render-prop on `<Bar>` — `ReportsView.tsx` uses that instead, per the deprecation notice.
