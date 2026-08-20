# `src/test/`

## Responsibility

Test-only infrastructure shared across the suite. Nothing here is imported by app code.

## Files

- **`setup.ts`** — registered as Vitest's `setupFiles` (see `vite.config.ts`'s `test` block). Imports `@testing-library/jest-dom/vitest` (adds matchers like `.toBeInTheDocument()`) and calls `cleanup()` after every test so DOM nodes from one test don't leak into the next.
- **`mockHooks.ts`** — `mockQueryResult`/`mockMutationResult` factories for faking React Query's `useQuery`/`useMutation` return shapes in component tests (see `../components/README.md` for the mocking pattern they support).

## Why mock hooks instead of rendering a real `QueryClientProvider`

Component tests in this project use `vi.mock('../hooks/useX')` to replace a hook's implementation outright, rather than wrapping components in a real `QueryClientProvider` backed by a mocked `axios`/network layer (e.g. via MSW). For this project's component count, mocking at the hook boundary is less setup per test and keeps each test focused on "does the component render/behave correctly given this data," not "does the whole data-fetching stack work" — that's what the manual end-to-end pass against the real backend (documented in `PROGRESS.md`) already covers.
