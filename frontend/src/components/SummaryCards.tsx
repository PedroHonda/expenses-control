import { useExpenses } from '../hooks/useExpenses'
import type { ExpenseFilters } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import { formatCurrency } from '../lib/format'

interface SummaryCardsProps {
  filters: ExpenseFilters
}

// The API max (spec 01 §4.4) -- see spec 02 §6 decision 1 for why summary
// totals are an approximation over this many rows rather than a dedicated
// server-side aggregate endpoint.
const SUMMARY_LIMIT = 200

export function SummaryCards({ filters }: SummaryCardsProps) {
  const { data, isPending } = useExpenses({ ...filters, skip: 0, limit: SUMMARY_LIMIT })
  const { data: categories } = useCategories()

  // Categories marked "exclude from Total" (spec 03) -- e.g. Payment/Refund
  // -- are skipped from the money sum, but Count intentionally still
  // reflects every filtered expense (see spec 03 §2.4).
  const excludedCategories = new Set(
    categories?.filter((category) => category.exclude_from_total).map((category) => category.name),
  )
  const total =
    data?.items.reduce(
      (sum, item) => (excludedCategories.has(item.category) ? sum : sum + item.value),
      0,
    ) ?? 0
  const count = data?.total ?? 0
  const isPartial = count > SUMMARY_LIMIT

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium text-slate-500">
          Total{isPartial ? ` (first ${String(SUMMARY_LIMIT)})` : ''}
        </p>
        <p className="text-2xl font-semibold text-slate-900">
          {isPending ? '…' : formatCurrency(total)}
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium text-slate-500">Count</p>
        <p className="text-2xl font-semibold text-slate-900">{isPending ? '…' : count}</p>
      </div>
    </div>
  )
}
