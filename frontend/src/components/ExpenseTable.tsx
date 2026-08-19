import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useDeleteExpense, useExpenses } from '../hooks/useExpenses'
import type { ExpenseFilters } from '../hooks/useExpenses'
import { CategoryBadge } from './CategoryBadge'
import { formatCurrency, formatDate } from '../lib/format'
import type { ExpenseResponse } from '../types/api'

interface ExpenseTableProps {
  filters: ExpenseFilters
  onEdit: (expense: ExpenseResponse) => void
}

const PAGE_SIZE = 25

/**
 * Pagination state (`page`) resets automatically whenever `filters` changes,
 * because the caller renders this with `key={JSON.stringify(filters)}` --
 * a fresh key remounts the component instead of needing an effect to reset
 * state in response to a prop change (react-hooks/set-state-in-effect).
 */
export function ExpenseTable({ filters, onEdit }: ExpenseTableProps) {
  const [page, setPage] = useState(0)
  const deleteExpense = useDeleteExpense()

  const { data, isPending, isError } = useExpenses({
    ...filters,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  })

  function handleDelete(expense: ExpenseResponse) {
    if (window.confirm(`Delete "${expense.title}"? This can't be undone.`)) {
      deleteExpense.mutate(expense.id)
    }
  }

  if (isPending) {
    return <p className="p-4 text-sm text-slate-500">Loading expenses…</p>
  }

  if (isError) {
    return <p className="p-4 text-sm text-rose-600">Failed to load expenses.</p>
  }

  if (data.items.length === 0) {
    return <p className="p-4 text-sm text-slate-500">No expenses match these filters.</p>
  }

  const from = page * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE + data.items.length, data.total)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Value</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Trip</th>
              <th className="px-4 py-2">Details</th>
              <th className="px-4 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((expense) => (
              <tr key={expense.id}>
                <td className="px-4 py-2 whitespace-nowrap">{formatDate(expense.date)}</td>
                <td className="px-4 py-2">{expense.title}</td>
                <td className="px-4 py-2 font-medium whitespace-nowrap">
                  {formatCurrency(expense.value)}
                </td>
                <td className="px-4 py-2">
                  <CategoryBadge name={expense.category} />
                </td>
                <td className="px-4 py-2">
                  {expense.trip !== null && expense.trip !== '' && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {expense.trip}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500">{expense.details ?? ''}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onEdit(expense)
                      }}
                      aria-label={`Edit ${expense.title}`}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDelete(expense)
                      }}
                      disabled={deleteExpense.isPending}
                      aria-label={`Delete ${expense.title}`}
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-sm text-slate-500">
        <span>
          {from}–{to} of {data.total}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPage((p) => Math.max(0, p - 1))
            }}
            disabled={page === 0}
            className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              setPage((p) => p + 1)
            }}
            disabled={to >= data.total}
            className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
