import { useState } from 'react'
import { Plus } from 'lucide-react'
import { SummaryCards } from './SummaryCards'
import { FilterBar } from './FilterBar'
import { ExpenseTable } from './ExpenseTable'
import { ExpenseForm } from './ExpenseForm'
import type { ExpenseFilters } from '../hooks/useExpenses'
import type { ExpenseResponse } from '../types/api'

export function DashboardView() {
  const [filters, setFilters] = useState<ExpenseFilters>({})
  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | null>(null)

  return (
    <div className="space-y-4">
      <SummaryCards filters={filters} />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setEditingExpense(null)
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
      <ExpenseTable
        key={JSON.stringify(filters)}
        filters={filters}
        onEdit={(expense) => {
          setEditingExpense(expense)
          setFormOpen(true)
        }}
      />
      {/* key forces a remount whenever a different target opens -- see
          ExpenseForm's own doc comment for why. */}
      <ExpenseForm
        key={formOpen ? (editingExpense?.id ?? 'new') : 'closed'}
        open={formOpen}
        expense={editingExpense}
        onClose={() => {
          setFormOpen(false)
        }}
      />
    </div>
  )
}
