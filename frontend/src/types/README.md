# `src/types/`

## Responsibility

TypeScript interfaces for everything that crosses the wire to/from the backend.

## Files

- **`api.ts`** — mirrors `backend/app/schemas/{expense,category,payment_method}.py` field-for-field, including `CategorySummaryItem`/`ExpenseSummaryResponse` (`GET /expenses/summary`, spec 06), `MonthlySummaryItem`/`ExpenseMonthlySummaryResponse` (`GET /expenses/summary-by-month`, spec 07), and `PaymentMethod` (spec 08). Kept as a hand-written mirror rather than a generated client: the API surface is small and stable behind approved specs (`.github/specs/01_api_contract.spec.md`), so codegen would be more machinery than the problem needs. If the backend schemas change, update this file to match — the two are meant to be read side by side.

## Why plain strings for dates

`date`, `created_at`, `updated_at` are typed `string`, not `Date`. That's what actually arrives over JSON (Pydantic serializes `date`/`datetime` to ISO 8601 strings); parsing into `Date` objects is deferred to wherever a component actually needs to format or compare one, rather than doing it eagerly for every API response.
