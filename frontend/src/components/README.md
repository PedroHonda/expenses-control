# `src/components/`

## Responsibility

The UI component tree. Structure and responsibilities follow `.github/specs/02_frontend_ux.spec.md` §3 directly.

## Files

- **`CategoryBadge.tsx`** — small colored pill for a category name. Color is a deterministic hash of the name (`src/lib/categoryColor.ts`), not a backend field — see spec 02 §6 decision 2.
- **`CategorySelect.tsx`** — shared category dropdown, used by `ExpenseForm`, `FilterBar`, and `CsvReviewTable`. Includes an inline "+ create new category" flow (calls `useCreateCategory`) so the user never has to leave the form they're filling out to add a category — categories are dynamic per the original project spec, and gating category creation behind a separate admin screen would fight that.

- **`ExpenseForm.tsx`** — manual entry, in a modal (`open`/`onClose` props). Client-side constraints mirror the backend's (`value > 0`, `title` 1–200 chars) for immediate feedback, but a failed `POST /expenses/` still surfaces the backend's actual error message via `getErrorMessage` — the client-side checks are a UX nicety, not the source of truth (spec 02 §5).
- **`FilterBar.tsx`** — date range / category / trip controls. Lifts filter state up (`filters`/`onChange` props) rather than owning it, since both `ExpenseTable` and `SummaryCards` need to react to the same filters.
- **`SummaryCards.tsx`** — total (sum of `value`) and count over the current filters. Fetches its own `limit=200` slice via `useExpenses` (see spec 02 §6 decision 1) — an approximation flagged in the UI if the real count exceeds 200. Skips any expense whose category has `exclude_from_total: true` (fetched via `useCategories`) from the Total sum only — Count is intentionally unaffected (spec 03 §2.4).
- **`ExpenseTable.tsx`** — read-only, paginated (25/page). Its `page` state is reset by the _parent_ remounting it with a fresh `key` derived from `filters` on every filter change, rather than a `useEffect` that calls `setState` — the latter is exactly the "effect used to sync state to a prop change" anti-pattern current React tooling (`eslint-plugin-react-hooks`) flags; a `key` change is the recommended way to reset a component's internal state in response to a prop.

- **`CsvDropzone.tsx`** — drag-and-drop (or click-to-browse) `.csv` upload. Client-side extension check mirrors the backend's, but the backend's own `400` is still surfaced via `getErrorMessage` if it disagrees. Calls `useUploadCsv`; hands the resulting `CSVParseResponse` up via `onParsed`.
- **`CsvReviewTable.tsx`** — the editable grid over `ParsedExpenseRow[]` described in spec 02 §2.2. Holds its own local `EditableRow[]` state (a superset of the parsed data: adds `excluded` and a live-recomputed "is this row complete" check, since fields are user-editable after parsing). On a `422` from `import-batch`, maps the backend's `{index, errors}[]` — where `index` is the position _within the submitted batch_, not the original row — back to the correct table row via an `includedRowIndexes` array captured at submit time, so a partial failure highlights the right row without losing any other edits.

- **`DashboardView.tsx`** / **`CsvImportView.tsx`** / **`SettingsView.tsx`** — screen-level containers. `DashboardView` owns `filters`/modal-open state and composes `SummaryCards`+`FilterBar`+`ExpenseTable`+`ExpenseForm`. `CsvImportView` owns the parsed-result state and switches between `CsvDropzone` and `CsvReviewTable`. `SettingsView` lists every category with a checkbox (`useCategories` + `useUpdateCategory`) to toggle its `exclude_from_total` flag — see spec 03. `App.tsx` toggles between the three via a manual `View` union (no router library, see `App.tsx`'s own comments).

## Tests

Most `.tsx` files here have a co-located `*.test.tsx` (Vitest + React Testing Library). They mock the relevant hook module (`vi.mock('../hooks/useX')`) rather than hitting a real backend or React Query cache — see `../test/README.md` for why. `CsvReviewTable.test.tsx` is the most involved: it verifies the auto-categorized-row pre-fill, the submit-disabled-until-complete gating, and specifically the batch-index-to-original-row-index remapping on a partial `422` (a regression test for logic that's easy to get subtly wrong once rows can be excluded).
