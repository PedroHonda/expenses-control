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
import { useExpenseMonthlySummary, useExpenseSummary } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import { CategoryMultiSelect } from './CategoryMultiSelect'
import { CategoryBadge } from './CategoryBadge'
import { categoryChartColor } from '../lib/categoryColor'
import { formatCurrency, formatMonthYear } from '../lib/format'

type ReportMode = 'category' | 'month' | 'pivot'

interface MonthlyRow {
  label: string
  total: number
  count: number
}

export function ReportsView() {
  const [mode, setMode] = useState<ReportMode>('category')
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
  const {
    data: monthlySummary,
    isPending: isMonthlyPending,
    isError: isMonthlyError,
  } = useExpenseMonthlySummary({ dateFrom, dateTo }, { enabled: mode !== 'category' })

  const defaultSelected = new Set(
    categories
      ?.filter((category) => !category.exclude_from_total)
      .map((category) => category.name) ?? [],
  )
  const selected = selectedOverride ?? defaultSelected

  const items = summary?.items.filter((item) => selected.has(item.category)) ?? []
  const selectedTotal = items.reduce((sum, item) => sum + item.total, 0)

  // Collapse the (year, month, category) rows down to one total per month,
  // summing only the currently-selected categories -- same client-side
  // filtering as `items` above, just grouped by calendar month instead.
  const monthlyTotals = new Map<string, MonthlyRow & { year: number; month: number }>()
  for (const item of monthlySummary?.items ?? []) {
    if (!selected.has(item.category)) continue
    const key = `${String(item.year)}-${String(item.month)}`
    const existing = monthlyTotals.get(key)
    if (existing) {
      existing.total += item.total
      existing.count += item.count
    } else {
      monthlyTotals.set(key, {
        year: item.year,
        month: item.month,
        label: formatMonthYear(item.year, item.month),
        total: item.total,
        count: item.count,
      })
    }
  }
  const monthlyRows = [...monthlyTotals.values()].sort(
    (a, b) => a.year - b.year || a.month - b.month,
  )

  // Pivot: one cell per (category, month), sharing the same selected-category
  // filter and month set (`monthlyRows`) as the modes above.
  const pivotCells = new Map<string, number>()
  const pivotCategoryTotals = new Map<string, number>()
  for (const item of monthlySummary?.items ?? []) {
    if (!selected.has(item.category)) continue
    const cellKey = `${item.category}|${String(item.year)}-${String(item.month)}`
    pivotCells.set(cellKey, (pivotCells.get(cellKey) ?? 0) + item.total)
    pivotCategoryTotals.set(
      item.category,
      (pivotCategoryTotals.get(item.category) ?? 0) + item.total,
    )
  }
  const pivotCategories = [...pivotCategoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category)
  const pivotGrandTotal = monthlyRows.reduce((sum, row) => sum + row.total, 0)

  function handleDateFromChange(event: ChangeEvent<HTMLInputElement>) {
    setDateFrom(event.target.value === '' ? undefined : event.target.value)
  }

  function handleDateToChange(event: ChangeEvent<HTMLInputElement>) {
    setDateTo(event.target.value === '' ? undefined : event.target.value)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm">
        {(['category', 'month', 'pivot'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option)
            }}
            className={`flex-1 rounded px-3 py-1.5 font-medium ${
              mode === option ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option === 'category' && 'By category'}
            {option === 'month' && 'By month'}
            {option === 'pivot' && 'By category & month'}
          </button>
        ))}
      </div>

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

      {mode === 'category' && (
        <>
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
        </>
      )}

      {mode === 'month' && (
        <>
          {isMonthlyPending && <p className="text-sm text-slate-500">Loading summary…</p>}
          {isMonthlyError && <p className="text-sm text-rose-600">Failed to load summary.</p>}

          {!isMonthlyPending && !isMonthlyError && monthlyRows.length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
              No expenses for the selected categories and date range.
            </p>
          )}

          {monthlyRows.length > 0 && (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyRows} margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis type="number" tickFormatter={formatCurrency} fontSize={12} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#059669" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Month/Year</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {monthlyRows.map((row) => (
                      <tr key={row.label}>
                        <td className="px-4 py-2">{row.label}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.total)}</td>
                        <td className="px-4 py-2 text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {mode === 'pivot' && (
        <>
          {isMonthlyPending && <p className="text-sm text-slate-500">Loading summary…</p>}
          {isMonthlyError && <p className="text-sm text-rose-600">Failed to load summary.</p>}

          {!isMonthlyPending && !isMonthlyError && pivotCategories.length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
              No expenses for the selected categories and date range.
            </p>
          )}

          {pivotCategories.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Category</th>
                    {monthlyRows.map((row) => (
                      <th key={row.label} className="px-4 py-2 text-right whitespace-nowrap">
                        {row.label}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pivotCategories.map((category) => (
                    <tr key={category}>
                      <td className="px-4 py-2">
                        <CategoryBadge name={category} />
                      </td>
                      {monthlyRows.map((row) => {
                        const value = pivotCells.get(
                          `${category}|${String(row.year)}-${String(row.month)}`,
                        )
                        return (
                          <td key={row.label} className="px-4 py-2 text-right whitespace-nowrap">
                            {value !== undefined ? formatCurrency(value) : '—'}
                          </td>
                        )
                      })}
                      <td className="px-4 py-2 text-right font-medium whitespace-nowrap">
                        {formatCurrency(pivotCategoryTotals.get(category) ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                    <td className="px-4 py-2">Total</td>
                    {monthlyRows.map((row) => (
                      <td key={row.label} className="px-4 py-2 text-right whitespace-nowrap">
                        {formatCurrency(row.total)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {formatCurrency(pivotGrandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
