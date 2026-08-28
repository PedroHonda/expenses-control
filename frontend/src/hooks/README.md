# `src/hooks/`

## Responsibility

React Query hooks — the only place components should reach for server data. No component calls `src/lib/api.ts` directly; it goes through one of these instead.

## Files

- **`useCategories.ts`** — `useCategories()` (query, key `['categories']`), `useCreateCategory()` (mutation, invalidates `['categories']` on success), `useUpdateCategory()` (mutation — `PATCH /categories/{id}`, currently just `exclude_from_total`; invalidates `['categories']` on success).
- **`usePaymentMethods.ts`** — mirrors `useCategories.ts`'s shape (`usePaymentMethods()`, `useCreatePaymentMethod()`), plus `useSetDefaultImportPaymentMethod()` (mutation — `PATCH /payment-methods/{id}` with `{is_default_for_import: true}`; the backend keeps this exclusive, so the hook's only input is which id becomes the new default). All three invalidate `['payment-methods']` on success. See `.github/specs/08_payment_methods.spec.md`.
- **`useExpenses.ts`** — `useExpenses(params)` (query, key `['expenses', params]` — `params` includes filters _and_ `skip`/`limit`, so the paginated table view and the `limit=200` summary fetch are cached as distinct entries, not fighting over one cache slot), `useCreateExpense()` (mutation, invalidates every `['expenses', ...]` entry via React Query's partial key matching), `useExpenseSummary(params)` / `useExpenseMonthlySummary(params, {enabled})` (queries, key prefixes `['expense-summary', ...]` / `['expense-monthly-summary', ...]` — separate from `['expenses', ...]`, since they hit different endpoints, `GET /expenses/summary` and `GET /expenses/summary-by-month`, unpaginated aggregations; see specs 06/07. `useExpenseMonthlySummary`'s `enabled` option lets `ReportsView` skip the fetch entirely while its "By category" mode is active. Neither is explicitly invalidated by the expense mutations below — the default `staleTime: 0` already refetches on every mount, i.e. every time the user navigates to the Reports view, which is enough here since nothing renders them concurrently with the Dashboard).
- **`useCsvImport.ts`** — `useUploadCsv()` (stage 1, parse-only — no cache invalidation, since nothing was persisted), `useImportBatch()` (stage 2, invalidates `['expenses', ...]` on success).

## Why the query key includes the full params object

`['expenses', { category: 'Uber', skip: 0, limit: 50 }]` and `['expenses', { skip: 0, limit: 200 }]` are different cache entries. This is intentional — the dashboard table and the summary cards fetch different slices of the same resource and shouldn't overwrite each other's cached result. `queryClient.invalidateQueries({ queryKey: ['expenses'] })` still invalidates _all_ of them after a mutation, since React Query matches query keys by prefix.
