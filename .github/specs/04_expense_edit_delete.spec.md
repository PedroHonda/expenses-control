# Spec 04: Expense Edit & Delete

**Status:** Draft — implemented same-session per user request (2026-08-19), documented for the record.
**Depends on:** Spec 01 (API contract), Spec 02 (frontend UX)
**Informs:** backend `expenses` router/service, frontend Dashboard

---

## 1. Context

User request (Portuguese, 2026-08-19): a way to edit database info from the main (Dashboard) page. Today `ExpenseTable` is read-only — expenses can only be created (`ExpenseForm`, create-only) or imported via CSV; there's no way to fix a typo or remove a bad row short of touching Mongo directly.

## 2. Design

Reuses the existing single-`Expense` CRUD surface rather than introducing anything new: `PUT` for a full-record edit (all fields required, same shape as create) and `DELETE` for removal. No new schema — `ExpenseCreate` is reused as the update body, since the edit form always collects every field (mirrors how `ExpenseResponse` already reuses `ExpenseCreate`).

### 2.1 `PUT /api/v1/expenses/{id}`
- Body: `ExpenseCreate` (full replace — same validation as create: `category` must match an existing `Category.name`, case-insensitive)
- `404` if `id` doesn't match an existing expense
- `422` (`detail: "unknown category: '<value>'"`) if `category` doesn't resolve
- **200** → `ExpenseResponse` (`updated_at` refreshed, `created_at` unchanged)

### 2.2 `DELETE /api/v1/expenses/{id}`
- `404` if `id` doesn't match an existing expense
- **204**, empty body

### 2.3 Frontend

- `useUpdateExpense`/`useDeleteExpense` mutations (`hooks/useExpenses.ts`), both invalidate the `expenses` query key on success.
- `ExpenseForm` gains an optional `expense: ExpenseResponse | null` prop. When set: fields prefill from it, title reads "Edit Expense", submit calls `useUpdateExpense` instead of `useCreateExpense`. `null`/omitted keeps today's create behavior unchanged.
- `ExpenseTable` gains an Actions column (edit pencil + delete trash icon per row) and an `onEdit(expense)` callback prop. Delete asks for confirmation (`window.confirm`) before mutating — no new modal component for a single yes/no.
- `DashboardView` holds `editingExpense: ExpenseResponse | null` state, passed to both `ExpenseTable` (`onEdit`) and `ExpenseForm` (`expense`); "Add Expense" button clears it back to `null` before opening the form.

## 3. Acceptance Criteria

- [ ] `PUT /expenses/{id}` with a valid payload updates the record and returns it with a fresh `updated_at`.
- [ ] `PUT` on a non-existent id returns `404`; `PUT` with an unknown category returns `422` and does not modify the record.
- [ ] `DELETE /expenses/{id}` removes the record (`204`); a subsequent `GET /expenses/` no longer includes it.
- [ ] `DELETE` on a non-existent id returns `404`.
- [ ] Dashboard table has working Edit (opens prefilled form, saves via `PUT`) and Delete (confirms, then removes via `DELETE`) actions per row.
