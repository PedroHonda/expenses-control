# Spec 03: Category Settings (exclude from Total)

**Status:** Draft — implemented same-session per user request (2026-08-18), documented for the record.
**Depends on:** Spec 01 (API contract), Spec 02 (frontend UX)
**Informs:** backend `Category` model, frontend Settings/admin page

---

## 1. Context

The dashboard's "Total" card (`SummaryCards.tsx`) sums every fetched expense's `value`, including expenses categorized as `Payment/Refund` — a category that represents bill payments/refunds, not real spending (see Spec 01 §6 decision 1). This inflates/distorts the Total.

User request (2026-08-18): stop counting `Payment/Refund` in the Total, and generalize this into a small admin/settings page where *any* category can be marked as excluded from the Total — not just `Payment/Refund` hardcoded.

## 2. Design

Extend the existing `Category` domain object with a new field rather than introduce a separate settings collection — this mirrors the existing `is_default` flag and needs no new document type, migration path, or singleton-document pattern.

### 2.1 `Category` (amended)

| Field | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `exclude_from_total` | `bool` | server-set, default `false` | When `true`, expenses in this category are skipped when computing the dashboard Total (not the Count, and not filtering — expenses in this category still show in the table and still match filters). |

`Payment/Refund` is seeded with `exclude_from_total: true` from the start (updated `backend/app/core/default_categories.json` seeding path — see §2.3); all other seeded/user-created categories default to `false`.

### 2.2 New endpoint: `PATCH /api/v1/categories/{id}`

- Body: `CategoryUpdate { exclude_from_total: bool }` (the only mutable field for now)
- `404` if `id` doesn't match an existing category
- **200** → `CategoryResponse` (now includes `exclude_from_total`)

### 2.3 Seeding

`default_categories.json` changes shape from `list[str]` to `list[{name, exclude_from_total}]` so `Payment/Refund` can ship pre-excluded without a manual admin-page step after first run. Seeder (`seed_default_categories`) reads the new shape; idempotency behavior (skip existing names, case-insensitive) is unchanged.

### 2.4 Frontend

- `Category` type gains `exclude_from_total: boolean`.
- New `useUpdateCategory` mutation (PATCH), invalidates the `categories` query on success.
- New **Settings** page (`SettingsView.tsx`): lists all categories with a checkbox per row, "Exclude from Total". Toggling calls the mutation immediately (no separate save step, matching the app's existing direct-mutation UX elsewhere).
- `App.tsx`: `View` union gains `'settings'`; header gets a settings (gear icon) button alongside the existing Import CSV button.
- `SummaryCards.tsx`: fetches categories (`useCategories`), builds a `Set` of excluded category names, and filters those out of the `reduce` sum. **Count is intentionally left unchanged** — it still reflects all filtered expenses, matching current behavior and avoiding a mismatch between the backend-computed `total` count and the (approximate, 200-row-capped) client-side Total sum.

## 3. Acceptance Criteria

- [ ] `GET /categories/` includes `exclude_from_total` for every category; `Payment/Refund` is `true` out of the box on a fresh seed.
- [ ] `PATCH /categories/{id}` with `{"exclude_from_total": true}` persists and is reflected in a subsequent `GET /categories/`.
- [ ] `PATCH` on a non-existent id returns `404`.
- [ ] Dashboard Total excludes expenses whose category has `exclude_from_total: true`; Count is unaffected.
- [ ] Settings page lists all categories with working checkboxes that persist via the API.
