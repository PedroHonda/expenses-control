import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { X } from 'lucide-react'
import { useCreateExpense, useUpdateExpense } from '../hooks/useExpenses'
import { CategorySelect } from './CategorySelect'
import { getErrorMessage } from '../lib/errors'
import { todayIso } from '../lib/format'
import type { ExpenseResponse } from '../types/api'

interface ExpenseFormProps {
  open: boolean
  onClose: () => void
  expense?: ExpenseResponse | null
}

const emptyForm = {
  date: todayIso(),
  title: '',
  value: '',
  category: '',
  details: '',
  trip: '',
}

function formFromExpense(expense: ExpenseResponse) {
  return {
    date: expense.date,
    title: expense.title,
    value: String(expense.value),
    category: expense.category,
    details: expense.details ?? '',
    trip: expense.trip ?? '',
  }
}

/**
 * The caller must remount this component (e.g. via a `key` that changes
 * between "closed", "new", and each edited expense's id -- see
 * DashboardView) whenever a different target opens. That's what lets a
 * plain `useState` initializer below pick up the right starting values
 * instead of needing an effect to re-sync form state from a changed prop.
 */
export function ExpenseForm({ open, onClose, expense = null }: ExpenseFormProps) {
  const [form, setForm] = useState(expense ? formFromExpense(expense) : emptyForm)
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const isEditing = expense !== null
  const mutation = isEditing ? updateExpense : createExpense

  if (!open) return null

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
      date: form.date,
      title: form.title.trim(),
      value: Number(form.value),
      category: form.category,
      details: form.details.trim() === '' ? null : form.details.trim(),
      trip: form.trip.trim() === '' ? null : form.trip.trim(),
    }
    const onSuccess = () => {
      onClose()
    }
    if (isEditing) {
      updateExpense.mutate({ id: expense.id, expense: payload }, { onSuccess })
    } else {
      createExpense.mutate(payload, { onSuccess })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEditing ? 'Edit Expense' : 'Add Expense'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="expense-date" className="block text-sm font-medium text-slate-700">
              Date
            </label>
            <input
              id="expense-date"
              type="date"
              required
              value={form.date}
              onChange={(event) => {
                setForm((f) => ({ ...f, date: event.target.value }))
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label htmlFor="expense-title" className="block text-sm font-medium text-slate-700">
              Title
            </label>
            <input
              id="expense-title"
              type="text"
              required
              minLength={1}
              maxLength={200}
              value={form.title}
              onChange={(event) => {
                setForm((f) => ({ ...f, title: event.target.value }))
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label htmlFor="expense-value" className="block text-sm font-medium text-slate-700">
              Value
            </label>
            <input
              id="expense-value"
              type="number"
              required
              min={0.01}
              step="0.01"
              value={form.value}
              onChange={(event) => {
                setForm((f) => ({ ...f, value: event.target.value }))
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label htmlFor="expense-category" className="block text-sm font-medium text-slate-700">
              Category
            </label>
            <CategorySelect
              id="expense-category"
              value={form.category}
              onChange={(value) => {
                setForm((f) => ({ ...f, category: value }))
              }}
              required
            />
          </div>

          <div>
            <label htmlFor="expense-trip" className="block text-sm font-medium text-slate-700">
              Trip (optional)
            </label>
            <input
              id="expense-trip"
              type="text"
              maxLength={100}
              value={form.trip}
              onChange={(event) => {
                setForm((f) => ({ ...f, trip: event.target.value }))
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label htmlFor="expense-details" className="block text-sm font-medium text-slate-700">
              Details (optional)
            </label>
            <textarea
              id="expense-details"
              maxLength={1000}
              rows={2}
              value={form.details}
              onChange={(event) => {
                setForm((f) => ({ ...f, details: event.target.value }))
              }}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-rose-600">{getErrorMessage(mutation.error)}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || form.category === ''}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
