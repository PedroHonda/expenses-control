# `src/lib/`

## Responsibility

Shared, non-component application code: the API client and the React Query client. Nothing here renders UI.

## Files

- **`api.ts`** — a configured `axios` instance (`baseURL` from `VITE_API_BASE_URL`, defaulting to `http://localhost:8000/api/v1` for local dev). All backend calls should go through this instance rather than constructing new `axios` calls with hardcoded URLs, so the base URL only needs to change in one place (e.g. for a Docker Compose setup in Phase 6).
- **`queryClient.ts`** — the single `QueryClient` instance, provided to the whole app via `QueryClientProvider` in `src/main.tsx`.

## Why Axios + React Query, not plain `fetch`

- **Axios**: automatic JSON parsing/serialization, and a `baseURL` option that keeps API calls terse (`api.get('/expenses/')` instead of repeating the full URL and manually parsing every response body) — thin convenience over `fetch`, not a heavy abstraction.
- **React Query** (`@tanstack/react-query`): server state (data that lives on the backend, e.g. the expense list) isn't the same kind of thing as UI state (e.g. "is this modal open") — React Query owns caching, re-fetching, and loading/error states for server data, so components don't hand-roll `useEffect` + `useState` data-fetching logic (a common source of stale-cache and race-condition bugs).
