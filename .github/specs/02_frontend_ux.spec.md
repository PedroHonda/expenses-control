# Spec 02: Frontend UX & Component Structure

**Status:** Approved — 2026-08-17 (see §6 for confirmed decisions)
**Depends on:** `.github/specs/01_api_contract.spec.md` (backend contract, approved)
**Informs:** Phase 4 implementation (component build-out)

---

## 1. Context

Backend (Phases 0–3) is complete: 6 endpoints, tested, running. This spec defines the frontend's screens, components, and state-management approach *before* building them, mirroring how `01_api_contract.spec.md` preceded backend implementation.

The single most important UX decision was already made with the user (2026-08-16, recorded in `01_api_contract.spec.md` §1): CSV import is a **two-stage, human-in-the-loop flow** — upload → editable review table → confirm — not a one-click auto-import. This spec's CSV Import view is built entirely around that.

**Out of scope for this phase** (because the backend doesn't support them yet — see `01_api_contract.spec.md` §4, no `PATCH`/`DELETE /expenses/{id}`): editing or deleting an already-saved expense. The expense table is read-only display for now.

## 2. Screens

Single-page app, no routing library — a `view` state (`'dashboard' | 'import'`) toggled by a nav control in the header, not URL-addressable. Simpler than wiring up `react-router` for two views with no deep-linking need; revisit if the app grows more screens.

### 2.1 Dashboard (default view)

```
┌─────────────────────────────────────────────┐
│ Header: "Expense Tracker"      [Import CSV] │
├─────────────────────────────────────────────┤
│ SummaryCards: Total (filtered) · Count       │
├─────────────────────────────────────────────┤
│ FilterBar: date range · category · trip      │
├─────────────────────────────────────────────┤
│ [+ Add Expense]                               │
├─────────────────────────────────────────────┤
│ ExpenseTable (paginated)                      │
│  Date | Title | Value | [Category badge]      │
│       | [Trip tag if present] | Details        │
└─────────────────────────────────────────────┘
```
- **SummaryCards**: `Total` = sum of `value` across the *currently filtered* result set (not all-time), `Count` = `total` from `GET /expenses/`. Computed client-side via a separate `GET /expenses/` call with `limit=200` (the API max) whenever filters change — see §6 decision 1 for why this approximation was chosen over a dedicated summary endpoint.
- **FilterBar**: `date_from`, `date_to`, `category` (dropdown from `GET /categories/`), `trip` (free-text, since `Expense.trip` isn't a separate collection). Changing any filter refetches `GET /expenses/` with the new query params.
- **"+ Add Expense"** opens `ExpenseForm` in a modal/dialog.
- **ExpenseTable**: read-only. `category` rendered as a colored `CategoryBadge` pill; `trip` (if present) as a smaller tag. Pagination via `skip`/`limit` (spec §4.4).

### 2.2 CSV Import (`[Import CSV]` nav)

```
Step 1: Dropzone
┌─────────────────────────────────────┐
│   Drag & drop a .csv, or browse      │
└─────────────────────────────────────┘
        │ upload-csv
        ▼
Step 2: Review table (editable)
┌───────────────────────────────────────────────────┐
│ Date | Title | Value | Category▾ | Details | Trip | ✓/✗ │
│ (pre-filled, read-only)  (dropdown, (text,   (text) (excl.)│
│                           required)  optional)              │
├───────────────────────────────────────────────────┤
│ Rows with parse_errors shown with an inline warning  │
│ [Submit N expenses]                                   │
└───────────────────────────────────────────────────┘
        │ import-batch
        ▼
Step 3: Result summary
"Imported 16 expenses." or per-row errors (422 case) with
the offending rows highlighted, still editable, resubmit.
```
- **CsvDropzone**: accepts `.csv` only (mirrors backend's extension check), calls `POST /expenses/upload-csv`, hands the `CSVParseResponse` to the review table.
- **CsvReviewTable**: one row per `ParsedExpenseRow`. `date`/`title`/`value` shown as parsed (editable text inputs — parsing can be wrong, e.g. `parse_errors` non-empty). `category` a required dropdown (same category list as the dashboard filter), pre-filled when the parser already resolved it (e.g. `Payment/Refund` on negative amounts) but always user-editable. `details`/`trip` optional free text. A row with `missing_required` non-empty is visually flagged until filled in; a row can be excluded (checkbox) from the submitted batch entirely (e.g. a duplicate or junk line). "Submit" is disabled while any *included* row still has a missing required field.
- On `422` from `import-batch` (per spec §4.3, `detail: [{index, errors}]`), map `index` back to the corresponding table row and show the error inline — the whole table stays editable for a retry, nothing is lost.

## 3. Components

| Component | Responsibility |
| :--- | :--- |
| `ExpenseForm` | Manual entry — controlled form calling `POST /expenses/`, category dropdown sourced from `GET /categories/` |
| `CsvDropzone` | File picker/drag-drop, calls `upload-csv`, forwards result up |
| `CsvReviewTable` | Editable grid over `ParsedExpenseRow[]`, calls `import-batch` on submit |
| `ExpenseTable` | Read-only paginated display of `ExpenseResponse[]` |
| `SummaryCards` | Derived stats over the current filtered set |
| `FilterBar` | Date range / category / trip filter controls |
| `CategoryBadge` | Small colored pill for a category name (color derived deterministically from the name — see §6.2) |
| `CategorySelect` | Shared dropdown (used by `ExpenseForm`, `FilterBar`, `CsvReviewTable`) wrapping `GET /categories/`, with an inline "+ create new" option calling `POST /categories/` |

## 4. Data Fetching (React Query)

| Query/Mutation key | Endpoint | Used by |
| :--- | :--- | :--- |
| `['categories']` | `GET /categories/` | `CategorySelect`, `FilterBar` |
| `['expenses', filters]` | `GET /expenses/` | `ExpenseTable`, `SummaryCards` |
| create-expense (mutation) | `POST /expenses/` | `ExpenseForm` — invalidates `['expenses', *]` on success |
| create-category (mutation) | `POST /categories/` | `CategorySelect` — invalidates `['categories']` |
| upload-csv (mutation) | `POST /expenses/upload-csv` | `CsvDropzone` — no cache invalidation (parse-only, nothing changed server-side) |
| import-batch (mutation) | `POST /expenses/import-batch` | `CsvReviewTable` — invalidates `['expenses', *]` on success |

## 5. Error & Loading Conventions

- Loading: React Query's `isPending` drives a simple inline spinner/skeleton — no global loading overlay.
- Errors: axios error responses surface FastAPI's `detail` field directly (string for single-object errors, array of `{index, errors}` for `import-batch`) — a shared `getErrorMessage(error: unknown)` helper in `src/lib/` normalizes both shapes for display.
- Form validation mirrors backend constraints client-side (`value > 0`, `title` 1–200 chars, etc.) for immediate feedback, but the backend response is still the source of truth — client-side checks are a UX nicety, not a substitute for handling a `422`.

## 6. Decisions (confirmed by user, 2026-08-17)

1. **Summary totals over more than one page**: fetch a high `limit` (200, the API max) for summary purposes whenever filters change; no dedicated summary endpoint for now. If `total > 200` in a filtered view, the UI notes the sum is partial. Revisit with a server-side aggregate only if real usage actually exceeds this.
2. **`CategoryBadge` color**: deterministic hash of the category name → one of a fixed Tailwind color palette. No `color` field added to `Category`.
3. **Light/dark mode**: light-only for this phase. Addable later as a pure Tailwind/CSS concern, no backend impact.

## 7. Acceptance Criteria

- [ ] Loading the dashboard with no filters shows all expenses, most recent first, with working pagination.
- [ ] Setting a category filter updates both the table and the summary total.
- [ ] Submitting `ExpenseForm` with an unknown category (shouldn't be possible via the dropdown, but tested via direct API misuse) surfaces the backend's `422` message near the category field.
- [ ] Uploading `samples/Nubank_2026-09-06.csv`-shaped data via `CsvDropzone` renders a review table where the negative-amount row already shows `Payment/Refund` selected, and the 16 purchase rows show an empty, required category dropdown.
- [ ] Submitting the review table with one row missing a category is blocked client-side (submit disabled) rather than round-tripping to the backend for a 422.
- [ ] Submitting a batch where the backend still rejects a row (e.g. a category deleted mid-session) shows the per-row error without losing the rest of the table's edits.
