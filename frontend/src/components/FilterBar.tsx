import type { ChangeEvent } from 'react'
import type { ExpenseFilters } from '../hooks/useExpenses'
import { CategorySelect } from './CategorySelect'
import { PaymentMethodSelect } from './PaymentMethodSelect'

interface FilterBarProps {
  filters: ExpenseFilters
  onChange: (filters: ExpenseFilters) => void
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function handleDateFromChange(event: ChangeEvent<HTMLInputElement>) {
    onChange({ ...filters, dateFrom: event.target.value === '' ? undefined : event.target.value })
  }

  function handleDateToChange(event: ChangeEvent<HTMLInputElement>) {
    onChange({ ...filters, dateTo: event.target.value === '' ? undefined : event.target.value })
  }

  function handleTripChange(event: ChangeEvent<HTMLInputElement>) {
    onChange({ ...filters, trip: event.target.value === '' ? undefined : event.target.value })
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined)

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label htmlFor="filter-date-from" className="block text-xs font-medium text-slate-500">
          From
        </label>
        <input
          id="filter-date-from"
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={handleDateFromChange}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label htmlFor="filter-date-to" className="block text-xs font-medium text-slate-500">
          To
        </label>
        <input
          id="filter-date-to"
          type="date"
          value={filters.dateTo ?? ''}
          onChange={handleDateToChange}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label htmlFor="filter-category" className="block text-xs font-medium text-slate-500">
          Category
        </label>
        <CategorySelect
          id="filter-category"
          value={filters.category ?? ''}
          onChange={(value) => {
            onChange({ ...filters, category: value === '' ? undefined : value })
          }}
          allowEmpty
        />
      </div>
      <div>
        <label htmlFor="filter-payment-method" className="block text-xs font-medium text-slate-500">
          Payment Method
        </label>
        <PaymentMethodSelect
          id="filter-payment-method"
          value={filters.paymentMethod ?? ''}
          onChange={(value) => {
            onChange({ ...filters, paymentMethod: value === '' ? undefined : value })
          }}
          allowEmpty
        />
      </div>
      <div>
        <label htmlFor="filter-trip" className="block text-xs font-medium text-slate-500">
          Trip
        </label>
        <input
          id="filter-trip"
          type="text"
          value={filters.trip ?? ''}
          onChange={handleTripChange}
          placeholder="Any"
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            onChange({})
          }}
          className="text-sm text-slate-500 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
