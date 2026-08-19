# `src/hooks/`

## Responsibility

React Query hooks — the only place components should reach for server data. No component calls `src/lib/api.ts` directly; it goes through one of these instead.

## Files

- **`useCategories.ts`** — `useCategories()` (query, key `['categories']`), `useCreateCategory()` (mutation, invalidates `['categories']` on success), `useUpdateCategory()` (mutation — `PATCH /categories/{id}`, currently just `exclude_from_total`; invalidates `['categories']` on success).
- **`useExpenses.ts`** — `useExpenses(params)` (query, key `['expenses', params]` — `params` includes filters _and_ `skip`/`limit`, so the paginated table view and the `limit=200` summary fetch are cached as distinct entries, not fighting over one cache slot), `useCreateExpense()` (mutation, invalidates every `['expenses', ...]` entry via React Query's partial key matching).
- **`useCsvImport.ts`** — `useUploadCsv()` (stage 1, parse-only — no cache invalidation, since nothing was persisted), `useImportBatch()` (stage 2, invalidates `['expenses', ...]` on success).

## Why the query key includes the full params object

`['expenses', { category: 'Uber', skip: 0, limit: 50 }]` and `['expenses', { skip: 0, limit: 200 }]` are different cache entries. This is intentional — the dashboard table and the summary cards fetch different slices of the same resource and shouldn't overwrite each other's cached result. `queryClient.invalidateQueries({ queryKey: ['expenses'] })` still invalidates _all_ of them after a mutation, since React Query matches query keys by prefix.
