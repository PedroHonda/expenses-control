import type { ChangeEvent } from 'react'
import { useState } from 'react'
import type { BarShapeProps } from 'recharts'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CategorySummaryItem } from '../types/api'
import { useExpenseSummary } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import { CategoryMultiSelect } from './CategoryMultiSelect'
import { CategoryBadge } from './CategoryBadge'
import { categoryChartColor } from '../lib/categoryColor'
import { formatCurrency } from '../lib/format'

export function ReportsView() {
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined)
  const [dateTo, setDateTo] = useState<string | undefined>(undefined)
  // null = "no explicit choice yet" -> falls back to defaultSelected below,
  // which itself depends on categories still loading. Deriving during
  // render (rather than syncing this via useEffect once categories arrive)
  // keeps the initial default and every later user toggle on the same code
  // path -- see CLAUDE.md's ExpenseForm precedent for why this project
  // avoids the set-state-in-effect pattern for this kind of derived default.
  const [selectedOverride, setSelectedOverride] = useState<Set<string> | null>(null)

  const { data: categories } = useCategories()
  const { data: summary, isPending, isError } = useExpenseSummary({ dateFrom, dateTo })

  const defaultSelected = new Set(
    categories
      ?.filter((category) => !category.exclude_from_total)
      .map((category) => category.name) ?? [],
  )
  const selected = selectedOverride ?? defaultSelected

  const items = summary?.items.filter((item) => selected.has(item.category)) ?? []
  const selectedTotal = items.reduce((sum, item) => sum + item.total, 0)

  function handleDateFromChange(event: ChangeEvent<HTMLInputElement>) {
    setDateFrom(event.target.value === '' ? undefined : event.target.value)
  }

  function handleDateToChange(event: ChangeEvent<HTMLInputElement>) {
    setDateTo(event.target.value === '' ? undefined : event.target.value)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor="reports-date-from" className="block text-xs font-medium text-slate-500">
            From
          </label>
          <input
            id="reports-date-from"
            type="date"
            value={dateFrom ?? ''}
            onChange={handleDateFromChange}
            className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label htmlFor="reports-date-to" className="block text-xs font-medium text-slate-500">
            To
          </label>
          <input
            id="reports-date-to"
            type="date"
            value={dateTo ?? ''}
            onChange={handleDateToChange}
            className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-2">
          <p className="text-xs font-medium text-slate-500">Selected total</p>
          <p className="text-xl font-semibold text-slate-900">
            {isPending ? '…' : formatCurrency(selectedTotal)}
          </p>
        </div>
      </div>

      <CategoryMultiSelect selected={selected} onChange={setSelectedOverride} />

      {isPending && <p className="text-sm text-slate-500">Loading summary…</p>}
      {isError && <p className="text-sm text-rose-600">Failed to load summary.</p>}

      {!isPending && !isError && items.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No expenses for the selected categories and date range.
        </p>
      )}

      {items.length > 0 && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <ResponsiveContainer width="100%" height={Math.max(200, items.length * 40)}>
              <BarChart layout="vertical" data={items} margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={formatCurrency} fontSize={12} />
                <YAxis dataKey="category" type="category" width={120} fontSize={12} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar
                  dataKey="total"
                  radius={[0, 4, 4, 0]}
                  shape={(props: BarShapeProps) => {
                    const item = props.payload as CategorySummaryItem
                    return <Rectangle {...props} fill={categoryChartColor(item.category)} />
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Count</th>
                  <th className="px-4 py-2 text-right">% of selected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.category}>
                    <td className="px-4 py-2">
                      <CategoryBadge name={item.category} />
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(item.total)}</td>
                    <td className="px-4 py-2 text-right">{item.count}</td>
                    <td className="px-4 py-2 text-right">
                      {selectedTotal > 0
                        ? `${((item.total / selectedTotal) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
