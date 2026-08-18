import { useState } from 'react'
import { Plus } from 'lucide-react'
import { SummaryCards } from './SummaryCards'
import { FilterBar } from './FilterBar'
import { ExpenseTable } from './ExpenseTable'
import { ExpenseForm } from './ExpenseForm'
import type { ExpenseFilters } from '../hooks/useExpenses'

export function DashboardView() {
  const [filters, setFilters] = useState<ExpenseFilters>({})
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="space-y-4">
      <SummaryCards filters={filters} />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setFormOpen(true)
          }}
          className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Expense
        </button>
      </div>
      {/* key forces a remount (and so a pagination reset) whenever filters
          change -- see ExpenseTable's own doc comment for why. */}
      <ExpenseTable key={JSON.stringify(filters)} filters={filters} />
      <ExpenseForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
        }}
      />
    </div>
  )
}
