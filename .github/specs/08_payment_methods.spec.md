# Spec 08: Payment Methods

**Status:** Draft — implemented same-session per user request (2026-08-28),
documented for the record (same lightweight pattern as specs 03-07).
**Depends on:** Spec 01 (API contract), Spec 03 (Category admin pattern in
Settings)
**Informs:** new `payment_methods` backend module, `Expense.payment_method`,
CSV import flow, `SettingsView`, `ExpenseForm`, `CsvReviewTable`

---

## 1. Context

User request (Portuguese, 2026-08-28): wants to tag each expense with a
payment method ("forma de pagamento"), seeded with three initial values
(Nubank, Pix, Mercado Pago), manageable from the Settings ("Admin") page.
All *existing* expenses should be backfilled as "Nubank". New CSV imports
should default every row's payment method to "Nubank", but the *which
value counts as the default* should itself be admin-configurable from
Settings — not hardcoded — since the user's primary card/account may
change over time.

## 2. Design

### 2.1 Backend: `PaymentMethod`, mirroring `Category`

New `PaymentMethod` document (`app/models/payment_method.py`), same shape
of unique-case-insensitive-name index as `Category`:

```python
class PaymentMethod(Document):
    name: str
    is_default: bool = False              # was part of the initial seed
    is_default_for_import: bool = False   # the current CSV-import default
```

Two different "default" concepts, deliberately not conflated:
`is_default` just records provenance (seeded vs. user-created), exactly
like `Category.is_default`. `is_default_for_import` is the one the admin
page actually controls, and is enforced **exclusive** by the service layer
(setting it on one method clears it on every other) — a single-select
control, not independent checkboxes like `Category.exclude_from_total`.

Seed file `app/core/default_payment_methods.json`:
```json
[
  { "name": "Nubank", "is_default_for_import": true },
  { "name": "Pix", "is_default_for_import": false },
  { "name": "Mercado Pago", "is_default_for_import": false }
]
```
`scripts/seed_payment_methods.py` mirrors `seed_categories.py` exactly
(idempotent, safe to re-run).

New router `app/api/v1/payment_methods.py`:
- `GET /payment-methods/` — list, sorted by name.
- `POST /payment-methods/` — create (admin page's "register more").
  409 on a case-insensitive duplicate, same as categories.
- `PATCH /payment-methods/{id}` — body `{"is_default_for_import": true}`;
  this is how Settings sets the CSV-import default. Setting it `false`
  directly is rejected (400) — the *only* way to change the default is to
  set a different method's flag `true`, so there's never a moment with
  zero or multiple defaults selected via the API.

### 2.2 Backend: `Expense.payment_method`

Added as a required field to `Expense` (model) and `ExpenseCreate`
(schema) — every expense records a payment method, the same way every
expense records a category. `expense_service.create_expense`/
`update_expense`/`create_expenses_batch` validate it against
`payment_method_service.find_payment_method_ci`, exactly parallel to the
existing category validation, raising a new `UnknownPaymentMethodError`
→ `422`.

### 2.3 CSV import: default-fill, not a required column

Bank exports don't have a payment-method column (a single Nubank export
*is* entirely Nubank), so `csv_parser.parse_csv` stays pure/DB-free and
does **not** try to resolve a default itself (it has no DB access, by
design — see `app/services/README.md`). Instead:

- `ParsedExpenseRow` gains `payment_method: str | None = None`, and
  `"payment_method"` is optionally recognized via `COLUMN_ALIASES` (in
  case a source file ever does have one) but is **not** added to
  `REQUIRED_FIELDS` inside the pure parser — a missing column isn't a
  parse failure.
- The `POST /expenses/upload-csv` route (which already does one
  DB-dependent post-processing pass, for duplicate-flagging) does a
  second pass: any row with `payment_method is None` gets filled with
  `payment_method_service.get_default_import_payment_method()`'s current
  value. This is the same "endpoint does the DB-dependent enrichment,
  parser stays pure" split already established for `is_duplicate`.
- The review table (`CsvReviewTable`) shows this pre-filled value in an
  editable dropdown per row, identical UX to `category`.

### 2.4 Frontend: `PaymentMethodSelect`, `usePaymentMethods`

Mirrors `CategorySelect`/`useCategories` — dropdown with inline
"+ Create new payment method…", used in both `ExpenseForm` (manual entry)
and `CsvReviewTable` (per-row override). `ExpenseForm`'s initial value
also defaults to the current CSV-import default (the same "sensible
starting point" the CSV flow uses), not left blank — unlike `category`,
which has no natural default and starts empty.

Badge coloring reuses `categoryColorClasses`/`categoryChartColor`
as-is (they're plain name-hash functions, not actually category-specific
despite the name) rather than adding a parallel color module.

### 2.5 Frontend: Settings page

New "Payment Methods" section below "Categories": a list with a radio
button per method ("CSV import default") wired to `PATCH
/payment-methods/{id}`, plus an inline create form (text input + "Add")
directly on the page — unlike categories (created from the expense form
dropdown only), the user explicitly asked to register new payment
methods *from Admin*.

### 2.6 `ExpenseTable`

Gains a `Payment Method` badge column, parallel to the existing
`Category` column, since the field now exists on every expense and the
table already shows every other stored attribute except `details`
(shown) and `trip` (shown) — omitting the new field would be the
inconsistent choice, not including it.

### 2.7 Backfilling existing data

One-off script `scripts/migrate_backfill_payment_method.py`: a raw
`payment_methods` collection update (`update_many` with
`{"payment_method": {"$exists": False}}` → `{"$set": {"payment_method":
"Nubank"}}`), run once against the real database. Deliberately a raw
Mongo update, not a Beanie `Expense.find().to_list()` round-trip —
existing documents are missing a field the (updated) `Expense` Pydantic
model now requires, so loading them through Beanie first would fail
validation before the fix could even run.

## 3. Out of scope

- No filter-by-payment-method in `FilterBar`/`GET /expenses/` (mirrors
  spec 06/07's category-selection-is-client-side-only precedent — can be
  added later if needed).
- No "delete a payment method" (categories don't support this either).
- No per-payment-method reporting/charts (out of scope, unlike category
  and month which already have dedicated Reports modes).
