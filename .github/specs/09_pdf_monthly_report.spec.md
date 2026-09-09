# Spec 09: PDF Export of the Monthly Consolidated Report

**Status:** Draft — awaiting review (2026-09-08).
**Depends on:** Spec 01 (API contract), Spec 07 (`summary-by-month` endpoint,
`ReportsView` pivot mode)
**Informs:** backend `expenses` router/service, new backend PDF-rendering
module, `ReportsView`

---

## 1. Context

User request (Portuguese, 2026-09-08): wants to generate a PDF report with
a month-by-month consolidated view of expenses ("um relatório em PDF com um
consolidado do mês a mês").

This is exactly the data already on screen in `ReportsView`'s "By category
& month" pivot mode (spec 07 §4): rows = categories, columns =
chronological months in the selected date range, cells = totals, plus a
Total column/row. No new aggregation is needed — this spec is about
rendering that existing dataset as a downloadable PDF instead of (or in
addition to) an HTML table.

**Decision:** implement PDF generation server-side, not client-side.

- The backend already computes the exact pivot inputs
  (`get_monthly_summary`); duplicating that grouping/sorting logic in the
  browser (as a client-side PDF lib like `jspdf` would require) is
  redundant and risks the two views drifting apart.
- Multi-page tables with a repeating header row are what PDF libraries are
  built for; `jspdf-autotable`-style client rendering handles this far
  more awkwardly than a server-side templating library.
- Keeps the frontend's role to "trigger a download," consistent with
  `CLAUDE.md`'s framing of this project (backend-heavy user, frontend kept
  thin).

**Library choice: ReportLab**, not WeasyPrint. WeasyPrint needs native
Pango/Cairo/GDK-Pixbuf libraries that are painful to install on Windows
(this project's primary dev environment, per `CLAUDE.md`); ReportLab is
pure Python, actively maintained, and its `platypus` layer (`SimpleDocTemplate`
+ `Table`) handles pagination and repeating header rows out of the box —
exactly what a long category list needs.

## 2. Design

### 2.1 Backend: PDF rendering endpoint

New endpoint, sibling to the existing summary endpoints:

```
GET /api/v1/expenses/summary-by-month/pdf?date_from=&date_to=&categories=A&categories=B...
```

- `date_from` / `date_to`: same optional semantics as `/summary-by-month`.
- `categories`: repeated query param, the *currently selected* category
  set from the frontend's `CategoryMultiSelect` state. Required (not
  defaulted server-side) — the PDF must reflect exactly what the user has
  selected on screen, not a server-computed default that could silently
  diverge from it.

Handler flow (`app/api/v1/expenses.py`):
1. Call the existing `expense_service.get_monthly_summary(date_from, date_to)`.
2. Pass its `items` plus the `categories` filter into a new
   `app/services/pdf_report_service.py::render_monthly_pivot_pdf(...)`,
   which:
   - Filters to selected categories (mirrors `ReportsView`'s client-side
     filter).
   - Builds the same pivot shape as spec 07 §4: rows = categories with
     data, sorted by category total descending; columns = months present
     in the filtered data, chronological, no zero-filled gaps; trailing
     Total column per row; Total footer row; empty cell = `—`.
   - Renders a landscape `SimpleDocTemplate` (A4) with a title (date range,
     or "All time" if both bounds omitted), a generated-at timestamp, and
     one `Table` (header row repeated on every page via `repeatRows=1`).
   - Returns raw PDF bytes.
3. Return `StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf")`
   with `Content-Disposition: attachment; filename="..."` — filename
   pattern `relatorio_mensal_<date_from>_a_<date_to>.pdf` (or
   `relatorio_mensal_todos_os_periodos.pdf` when both bounds are omitted).
4. If the filtered pivot has zero rows (no matching expenses), respond
   `404` with a clear error message instead of an empty PDF — mirrors how
   `ReportsView` shows "No expenses..." instead of an empty chart/table.

New dependency: `reportlab` (added to `backend/pyproject.toml`
`[project].dependencies`).

### 2.2 Frontend: "Download PDF" button

- Added to `ReportsView`'s **pivot mode only** (`mode === 'pivot'`) — the
  one view whose data this PDF mirrors 1:1. Category mode and month-only
  mode PDF export are out of scope (§3).
- A button next to the pivot table, disabled while `pivotCategories.length
  === 0` (same empty-state guard as the table itself).
- On click: `api.get('/expenses/summary-by-month/pdf', { params: { date_from, date_to, categories: [...selected] }, responseType: 'blob' })`,
  then build an object URL from the blob and trigger a download via a
  temporary `<a download>` element — no new frontend dependency, this is
  plain browser/axios blob handling already compatible with the existing
  `api` client (`frontend/src/lib/api.ts`).
- Filename on the client side: read from the response's
  `Content-Disposition` header if present, else fall back to a generic
  `relatorio-mensal.pdf`.
- Errors (network failure, the backend's 404-on-empty-data case): surface
  a short inline error message near the button, same visual pattern as
  the existing `isError` messages in this view (no toast system in the
  project yet).

## 3. Out of scope

- PDF export for the "By category" and "By month" (non-pivot) modes —
  can be added later as thin variants of the same
  `pdf_report_service` if requested; not built speculatively now.
- Charts/graphics inside the PDF — table-only, matching what "consolidado"
  (a consolidated table) implies; the on-screen bar charts are not
  reproduced.
- Automatic pagination *sideways* for date ranges wide enough that months
  don't fit one landscape page's width (e.g. multi-year ranges) — same
  "not an edge case at this data volume" call as spec 07 §3's monthly
  view.
- Emailing or scheduling the report — this is an on-demand download only.
- Any other export format (CSV, XLSX) — explicitly out of scope per spec
  06 §3 and spec 07 §3; this spec only adds PDF.
