# Spec 07: Monthly/Yearly Consolidated View

**Status:** Draft — implemented same-session per user request (2026-08-27),
documented for the record (same lightweight pattern as specs 03/04/05/06:
well-scoped, flagged rather than paused on for a separate review round).
**Depends on:** Spec 01 (API contract), Spec 06 (Category Reports view,
`CategoryMultiSelect`, `useExpenseSummary` pattern)
**Informs:** backend `expenses` router/service/schemas, `ReportsView`

---

## 1. Context

User request (Portuguese, 2026-08-27): wants a consolidated view of
expenses by Month/Year ("consolidado por Mês/Ano"). This is the same shape
of problem as spec 06 (aggregate + chart + table over a date range with
category selection), just grouped by calendar month instead of by
category.

**Decision:** add a second mode to the existing `ReportsView` — a
`By category` / `By month` toggle — rather than a new top-level nav item
or a new page. Reports already owns the date-range filter and
`CategoryMultiSelect`; both apply equally to a monthly breakdown, so
reusing the same screen avoids duplicating that filter UI and keeps a
single place for "reporting".

## 2. Design

### 2.1 Backend: new aggregation endpoint

`GET /api/v1/expenses/summary-by-month?date_from=&date_to=` — same
optional date-range semantics as `/summary`. Runs a MongoDB `$group` by
`{year, month, category}` (`$sum: value` as `total`, `$sum: 1` as
`count`), sorted by year, month, then total descending.

Grouping still includes `category` (not just year/month) for the same
reason as spec 06 §2.1: the frontend fetches one full breakdown for the
date range and filters to the selected category set client-side, so
toggling categories doesn't refetch.

```python
class MonthlySummaryItem(BaseModel):
    year: int
    month: int
    category: str
    total: float
    count: int

class ExpenseMonthlySummaryResponse(BaseModel):
    items: list[MonthlySummaryItem]
```

### 2.2 Frontend: `ReportsView` "By month" mode

- A small toggle (`By category` / `By month`) above the existing date
  filters, both reused unchanged by the new mode.
- `CategoryMultiSelect` also reused unchanged — monthly totals are summed
  only over the currently-selected categories, same default (every
  category not flagged `exclude_from_total`) as the category mode.
- New `useExpenseMonthlySummary(dateFrom, dateTo)` hook, mirroring
  `useExpenseSummary`.
- Client-side pivot: group the fetched `{year, month, category, total,
  count}` rows by `(year, month)`, filter to selected categories, sum
  `total`/`count` per month. Months with zero selected-category spend in
  range are simply absent (no zero-filling of gaps).
- Chart: vertical bar chart, X axis = month label (`MM/YYYY`), Y axis =
  total, chronological order (oldest to newest) — the natural reading
  order for a trend, unlike the category chart's descending-by-total
  order.
- Table: Month/Year, Total, Count — same chronological order.

## 3. Out of scope

- No year-only aggregation level or year subtotals — a full year's totals
  are visible as 12 rows/bars, which is enough at this data volume.
- No CSV/PDF export.

## 4. Amendment (user, 2026-08-27): category × month pivot table

Same-session follow-up: the "By month" mode above gives a per-month
*total*, but the user actually wants the per-category breakdown *per
month* too — equivalent to re-running the "By category" view once per
month (first/last day of each month as the date filter) and reading them
side by side, which is exactly the tedious manual workflow this should
replace. Request (Portuguese): "um consolidado por mês dividido também
por categoria... uma tabela grande com as linhas o gasto por categoria e
as colunas os meses/ano em ordem".

**Decision:** a third `ReportsView` mode ("By category & month"), not a
new endpoint. `GET /expenses/summary-by-month` already returns
`{year, month, category, total, count}` rows — the exact cells of this
pivot — so this is a pure frontend addition:

- Reuses the same `useExpenseMonthlySummary(dateFrom, dateTo)` fetch as
  the "By month" mode (the `enabled` gate widens to `mode !== 'category'`
  so either month-based mode triggers the fetch).
- Rows: categories that appear in the filtered data (same "only
  categories with data, then intersect with `selected`" rule as the other
  two modes), sorted by each category's own total descending — mirrors
  the "By category" table's sort.
- Columns: the same set of months as the "By month" mode's `monthlyRows`
  (chronological, only months with any selected-category spend — no
  zero-filled gaps), plus a trailing `Total` column per row.
- A `Total` footer row sums each month column (matching "By month"'s
  per-month totals) plus a grand total in the corner.
- A cell with no expenses for that category in that month renders `—`,
  not `R$ 0,00` — `Expense.value` is validated `> 0` (spec 01), so every
  real cell value is strictly positive and `—` is unambiguous.
- The table is wrapped in `overflow-x-auto` (not `overflow-hidden` like
  the other two tables) since a full year is 12 month columns plus
  Category and Total — wider than the viewport is expected, not an edge
  case.
