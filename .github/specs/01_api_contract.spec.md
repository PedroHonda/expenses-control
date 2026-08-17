# Spec 01: Backend/Frontend API Contract

**Status:** Approved — 2026-08-16 (see §6 for confirmed decisions)
**Depends on:** none (first spec)
**Informs:** Phase 2 (backend implementation), Phase 4 (frontend implementation)

---

## 1. Context

Confirmed with user (2026-08-16): CSV import is a **two-stage** flow, not one-shot auto-import.

1. User uploads a raw bank-export CSV (e.g. `samples/Nubank_2026-09-06.csv`, columns `date,title,amount` only — no `Category`).
2. Backend parses whatever columns are present and returns them, unpersisted, row by row.
3. Frontend renders an **editable review table** pre-filled with the parsed fields; user fills in `Category` (required) and optionally `Details`/`Trip` per row, and may exclude/edit rows.
4. User submits the completed table; backend validates and persists the whole batch.

Rows with a **negative source amount** (e.g. a Nubank bill payment, `"- 2.403,28"`) are a special case: they represent a payment/refund, not a purchase. These are auto-categorized into a dedicated `Pagamento/Estorno` category during parsing (see §2.2, §6) rather than left for the user to categorize manually.

This contract therefore splits CSV import into two endpoints: `upload-csv` (parse only, no side effects) and `import-batch` (validate + persist). This is the key deviation from the single `POST /expenses/upload-csv` endpoint sketched in `PROMPT_SPECIFICATION_EN.md` §Phase 2 — that endpoint is kept, but its contract is "parse and return", not "parse and persist".

## 2. Domain Model

### 2.1 Expense (canonical fields)

| Field | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `str` (Mongo ObjectId as string) | server-set | |
| `date` | `date` (ISO 8601 `YYYY-MM-DD`) | yes | |
| `title` | `str`, 1–200 chars | yes | |
| `value` | `float`, > 0 | yes | Always stored as a positive absolute value; sign/direction is not modeled on `Expense` itself — a negative source amount is instead signaled via the `Pagamento/Estorno` category (see §6) |
| `category` | `str` | yes | Must match an existing `Category.name` (case-insensitive) — this is the confirmed reference style (by name, not by id; see §6) |
| `details` | `str`, ≤ 1000 chars | no | |
| `trip` | `str`, ≤ 100 chars | no | free-form tag, not a separate collection |
| `created_at` | `datetime` | server-set | |
| `updated_at` | `datetime` | server-set | |

### 2.2 Category

| Field | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `str` | server-set | |
| `name` | `str`, 1–50 chars | yes | unique, case-insensitive |
| `is_default` | `bool` | server-set | `true` for the 18 seeded categories, `false` for user-created ones |

Default seeded set: the 17 categories from `PROMPT_SPECIFICATION_EN.md` §2 (`Estacionamento, Pedágio, Presentes, Games, Casa, Supermercado, Food, Padaria, Gasolina, Farmácia, Health, Care, Entretenimento, Show, Compras, Carro, Uber`) **plus `Pagamento/Estorno`** — a new special category (confirmed by user, 2026-08-16) used exclusively to auto-classify negative-amount rows during CSV import (bill payments, refunds). Nothing prevents a user from also assigning it manually, but it's not intended as a general-purpose category.

## 3. Pydantic Schemas (DTOs)

```python
# Category
class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)

class CategoryResponse(BaseModel):
    id: str
    name: str
    is_default: bool

# Expense
class ExpenseCreate(BaseModel):
    date: date
    title: str = Field(min_length=1, max_length=200)
    value: float = Field(gt=0)
    category: str
    details: str | None = Field(default=None, max_length=1000)
    trip: str | None = Field(default=None, max_length=100)

class ExpenseResponse(ExpenseCreate):
    id: str
    created_at: datetime
    updated_at: datetime

# CSV parse (stage 1 — upload-csv)
class ParsedExpenseRow(BaseModel):
    row_index: int                     # 0-based position in the uploaded file
    date: date | None
    title: str | None
    value: float | None
    category: str | None               # populated only if the CSV happened to have this column
    details: str | None
    trip: str | None
    missing_required: list[str]        # e.g. ["category"] — required fields not present after parsing
    parse_errors: list[str]            # e.g. ["value: could not parse '12,x3' as a number"]
    raw: dict[str, str]                # original row, verbatim, for user reference/debugging

class CSVParseResponse(BaseModel):
    filename: str
    detected_columns: list[str]        # canonical field names successfully mapped from the file's header
    unmapped_columns: list[str]        # header columns present in the file but not mapped to any known field
    rows: list[ParsedExpenseRow]

# CSV import (stage 2 — import-batch)
class ImportBatchRequest(BaseModel):
    expenses: list[ExpenseCreate] = Field(min_length=1)

class ImportBatchResponse(BaseModel):
    created: list[ExpenseResponse]
    count: int
```

## 4. Endpoints

### 4.1 `POST /api/v1/expenses/`
Manual single-entry creation.
- Body: `ExpenseCreate`
- `category` must match an existing `Category.name` (case-insensitive) → else `422` with `detail: "unknown category: '<value>'"`
- **201** → `ExpenseResponse`

### 4.2 `POST /api/v1/expenses/upload-csv`
Stage 1: parse only, **no persistence**.
- `multipart/form-data`, field `file`, `.csv` only, max 5 MB
- Header matching is case-insensitive and alias-aware (e.g. `amount`/`value`/`valor` → `value`; `date`/`data` → `date`; `title`/`description`/`descrição` → `title`)
- Number parsing must handle both `1234.56` and Brazilian-locale `"1.234,56"` / `"- 2.403,28"` (leading space + minus, comma decimal, period thousands separator)
- **Negative-amount rows**: `value` is stored as the absolute value, and `category` is auto-set to `"Pagamento/Estorno"` (not left `null`) — such rows do **not** appear in `missing_required` for the category field, since the parser already resolved it. The user can still overwrite the category in the review table if the auto-classification is wrong.
- Rows that fail to parse are still returned (with `parse_errors` populated), never silently dropped
- **200** → `CSVParseResponse`
- `400` if the file isn't a valid CSV at all (unreadable/empty)

### 4.3 `POST /api/v1/expenses/import-batch`
Stage 2: validate + persist the batch the user completed in the review table.
- Body: `ImportBatchRequest`
- **All-or-nothing validation**: every `ExpenseCreate` in the array is validated (including category existence) before any insert happens. If any row fails, nothing is persisted.
- `422` on validation failure → `detail` is a list of `{index, errors}` so the frontend can highlight the offending table row(s)
- **201** → `ImportBatchResponse`

### 4.4 `GET /api/v1/expenses/`
Filtering + pagination.
- Query params: `date_from: date | None`, `date_to: date | None`, `category: str | None`, `trip: str | None`, `skip: int = 0`, `limit: int = 50 (max 200)`
- **200** → `{ items: list[ExpenseResponse], total: int }`

### 4.5 `GET /api/v1/categories/`
- **200** → `list[CategoryResponse]`, seeded defaults + user-created, alphabetical

### 4.6 `POST /api/v1/categories/`
- Body: `CategoryCreate`
- `409` if name already exists (case-insensitive)
- **201** → `CategoryResponse`

## 5. Error Handling

- Standard FastAPI validation errors stay as FastAPI's native `422` shape for single-object bodies (`ExpenseCreate`, `CategoryCreate`).
- Domain errors (unknown category, duplicate category name) use `HTTPException` with a plain `detail: str` message — `422` for "invalid reference" (unknown category), `409` for "conflict" (duplicate category).
- `import-batch` is the one endpoint with a structured (non-default) `422` body — see §4.3 — because it's validating an array and the frontend needs to map errors back to table rows.
- All error responses are JSON; no HTML error pages.

## 6. Decisions (confirmed by user, 2026-08-16)

1. **Negative amounts**: a dedicated `Pagamento/Estorno` category is seeded (see §2.2). Negative-amount CSV rows are auto-categorized into it during parsing, with `value` stored as the absolute value — not excluded from import, not left for the user to categorize. The user can still override the category in the review table.
2. **`category` reference style**: by `Category.name` (string), not by `id`. Simpler, matches the CSV/manual-entry UX directly. Accepts minor risk of orphaned strings if a category is later renamed — category rename/delete is out of scope for this phase.
3. **Auth/multi-user**: none. Single-user, no authentication, consistent with the "Personal Expense Tracker" framing. Revisit only if the project scope changes.

## 7. Acceptance Criteria

- [ ] Uploading `samples/Nubank_2026-09-06.csv` to `upload-csv` returns 17 parsed rows; the 16 positive-amount rows have `title` and `value` populated, `category` null, `missing_required: ["category"]`, with correctly parsed Brazilian-locale amounts (e.g. `"38,97"` → `38.97`).
- [ ] The negative-amount row (`"- 2.403,28"`, `"Pagamento recebido"`) is returned with `value: 2403.28`, `category: "Pagamento/Estorno"`, and does **not** appear in `missing_required`.
- [ ] The seeded category list (`GET /categories/`) includes all 17 original defaults plus `Pagamento/Estorno`, all with `is_default: true`.
- [ ] Submitting a completed batch to `import-batch` with one row referencing an unknown category returns `422` and creates zero expenses.
- [ ] `GET /expenses/?category=Uber&date_from=2026-08-01&date_to=2026-08-31` returns only matching rows within range.
- [ ] Creating a category with a name that differs only by case from an existing one (including `pagamento/estorno` vs `Pagamento/Estorno`) returns `409`.
