# Spec 05: CSV Import Duplicate Detection

**Status:** Draft — implemented same-session per user request (2026-08-19), documented for the record.
**Depends on:** Spec 01 (API contract — `upload-csv` stage 1 flow)
**Informs:** backend `expenses` router/service, frontend `CsvReviewTable`

---

## 1. Context

User request (Portuguese, 2026-08-19): when importing a new statement CSV
that overlaps a previously-imported one, rows already entered show up
again. Today every parsed row defaults `Include = checked`, so re-importing
a statement means manually unchecking every row already in the database —
easy to miss one and end up with a duplicate expense.

## 2. Design

A row counts as a likely duplicate when an existing `Expense` shares the
same `date`, the same `value`, and a `title` that matches case-insensitively.
No new endpoint: the check runs as a second step inside the existing
`POST /expenses/upload-csv` (stage 1, parse-only — still no persistence).

### 2.1 `ParsedExpenseRow` gains `is_duplicate: bool` (default `False`)

Set by the route, not by `csv_parser.parse_csv`, since the parser is
deliberately database-free and unit-testable in isolation (see
`learning/003`). `app/services/expense_service.find_duplicate_keys`
performs the actual lookup: given the batch's `(date, title, value)`
candidates, it fetches existing expenses whose `date` is in the candidate
set (`$in`, one query) and matches title/value in Python.

### 2.2 Frontend (`CsvReviewTable`)

- `toEditableRow` seeds `excluded: row.is_duplicate` instead of always
  `false` — a flagged row starts unchecked.
- The Include checkbox gets a `title` tooltip (native, no new dependency)
  explaining the match and that the user can still check it to import
  anyway, plus a small ⚠ marker so the state is visible without hovering.
- The flag is descriptive only — checking the box re-includes the row like
  any other; nothing is silently dropped.

## 3. Acceptance Criteria

- [x] Uploading a CSV row whose `(date, title, value)` matches an existing
      `Expense` (title case-insensitive) returns that row with
      `is_duplicate: true`; non-matching rows return `false`.
- [x] A duplicate-flagged row renders with its Include checkbox unchecked
      by default and a hover tooltip explaining why.
- [x] The user can still check the box and submit a flagged row — the flag
      never blocks import, it only changes the default.
- [x] `upload-csv` remains parse-only: the duplicate check reads existing
      expenses but writes nothing.
