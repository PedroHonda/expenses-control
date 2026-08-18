# `src/lib/`

## Responsibility

Shared, non-component application code: the API client and the React Query client. Nothing here renders UI.

## Files

- **`api.ts`** — a configured `axios` instance (`baseURL` from `VITE_API_BASE_URL`, defaulting to `http://localhost:8000/api/v1` for local dev). All backend calls should go through this instance rather than constructing new `axios` calls with hardcoded URLs, so the base URL only needs to change in one place (e.g. for a Docker Compose setup in Phase 6).
- **`queryClient.ts`** — the single `QueryClient` instance, provided to the whole app via `QueryClientProvider` in `src/main.tsx`.
- **`errors.ts`** — `getErrorMessage(error)` (a human-readable string for any caught error) and `getImportBatchRowErrors(error)` (extracts the structured `{index, errors}[]` shape from a failed `import-batch` call specifically, for `CsvReviewTable` to map back to table rows). Both normalize axios's `error.response.data.detail`, which is either a plain string or that array depending on which endpoint failed (spec 01 §5).
- **`categoryColor.ts`** — `categoryColorClasses(name)`, a deterministic name→Tailwind-class hash used by `CategoryBadge` (spec 02 §6 decision 2).
- **`format.ts`** — `formatCurrency`/`formatDate`/`todayIso`, `pt-BR`/`BRL` (the target user and sample data are Brazilian; not currently configurable). `todayIso()` deliberately uses local-timezone `Date` accessors, not `toISOString()` — see its doc comment and `format.test.ts` for the live bug that motivated this.

Each file above has a co-located `*.test.ts` — these are pure unit tests (no rendering, no mocking) since nothing in this directory touches React.

## Why Axios + React Query, not plain `fetch`

- **Axios**: automatic JSON parsing/serialization, and a `baseURL` option that keeps API calls terse (`api.get('/expenses/')` instead of repeating the full URL and manually parsing every response body) — thin convenience over `fetch`, not a heavy abstraction.
- **React Query** (`@tanstack/react-query`): server state (data that lives on the backend, e.g. the expense list) isn't the same kind of thing as UI state (e.g. "is this modal open") — React Query owns caching, re-fetching, and loading/error states for server data, so components don't hand-roll `useEffect` + `useState` data-fetching logic (a common source of stale-cache and race-condition bugs).
