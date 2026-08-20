# Spec 06: Category Reports View

**Status:** Draft — implemented same-session per user request (2026-08-20), documented for the record (same lightweight pattern as specs 03/04/05: well-scoped, flagged rather than paused on for a separate review round).
**Depends on:** Spec 01 (API contract), Spec 03 (category `exclude_from_total`)
**Informs:** backend `expenses` router/service/schemas, new frontend `ReportsView`

---

## 1. Context

User request (Portuguese, 2026-08-20): liked the category-selection UX already
in the app, and wants a new page with charts and tables summarizing expenses
by category over a date range (`from`/`to`), with the ability to select and
deselect which categories are included in the summary. Open question from the
user: whether this should be a new page or a pagination/tab toggle on top of
the existing Dashboard.

**Decision:** a new `reports` view added to the existing `App.tsx` view-toggle
(`dashboard` / `import` / `settings` today) — not a router. The app has no
routing library and 3 screens already share this exact pattern (local
`useState<View>` + header nav buttons); adding a 4th view is consistent and
doesn't introduce a new dependency for navigation alone.

## 2. Design

### 2.1 Backend: new aggregation endpoint

The existing `GET /expenses/` is paginated (`limit<=200`) and has no
`GROUP BY`; `SummaryCards` already works around this with a documented
approximation (client-side sum over the first 200 rows). A dedicated
reports view over an arbitrary date range should not inherit that
approximation, so a real aggregation endpoint is added instead of reusing
the list endpoint.

`GET /api/v1/expenses/summary?date_from=&date_to=` — both optional, same
semantics as `list_expenses`. Runs a MongoDB `$group` by `category`
(`$sum: value` as `total`, `$sum: 1` as `count`) over *all* matching
expenses (no `limit`/`skip` — this is exactly the case pagination doesn't
fit), sorted by `total` descending.

No `category` filter param: the frontend fetches one full per-category
breakdown for the date range and does category selection client-side
(toggling which series/rows are visible), matching "select and deselect
categories" — instant toggling, no refetch per checkbox click.

```python
class CategorySummaryItem(BaseModel):
    category: str
    total: float
    count: int

class ExpenseSummaryResponse(BaseModel):
    items: list[CategorySummaryItem]
```

### 2.2 Frontend: `ReportsView`

- New nav button in `App.tsx` (4th view, `BarChart3` icon), same toggle
  pattern as Import/Settings.
- Date range inputs (`from`/`to`, reusing `FilterBar`'s date-input style),
  defaulting to empty (all-time) like the Dashboard's filters.
- New `CategoryMultiSelect` component: checkbox per category (from
  `useCategories`), "Select all" / "Deselect all" actions. Default
  selection = every category *not* flagged `exclude_from_total` (mirrors
  the Dashboard Total's default so the initial report matches what the
  user is used to), but any category can be freely toggled on/off —
  unlike the Dashboard, this view is meant to also let the user inspect
  excluded categories (e.g. `Payment/Refund`) on demand.
- Fetches the full per-category breakdown once per date-range change via
  `useExpenseSummary(dateFrom, dateTo)`, then filters to the selected set
  client-side for both the chart and the table — no refetch on
  select/deselect.
- Chart: horizontal bar chart by category (new dependency: `recharts`,
  actively maintained, no other charting lib in the project yet).
- Table: category, total, count, % of the selected total — sorted by
  total descending (same order the backend already returns).

## 3. Out of scope

- No new backend filter for arbitrary category subsets — selection is
  client-side only, per §2.1.
- No saved/named report presets.
- No CSV/PDF export of the report.
