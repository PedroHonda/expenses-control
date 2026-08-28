import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportsView } from './ReportsView'
import { useCategories } from '../hooks/useCategories'
import { useExpenseMonthlySummary, useExpenseSummary } from '../hooks/useExpenses'
import { mockQueryResult } from '../test/mockHooks'
import type { Category, ExpenseMonthlySummaryResponse, ExpenseSummaryResponse } from '../types/api'

vi.mock('../hooks/useCategories')
vi.mock('../hooks/useExpenses')

const categories: Category[] = [
  { id: '1', name: 'Food', is_default: true, exclude_from_total: false },
  { id: '2', name: 'Payment/Refund', is_default: true, exclude_from_total: true },
]

const summary: ExpenseSummaryResponse = {
  items: [
    { category: 'Food', total: 150, count: 3 },
    { category: 'Payment/Refund', total: 2000, count: 1 },
  ],
}

const monthlySummary: ExpenseMonthlySummaryResponse = {
  items: [
    { year: 2026, month: 7, category: 'Food', total: 100, count: 2 },
    { year: 2026, month: 8, category: 'Food', total: 50, count: 1 },
    { year: 2026, month: 8, category: 'Payment/Refund', total: 2000, count: 1 },
  ],
}

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
  vi.mocked(useExpenseSummary).mockReturnValue(mockQueryResult({ data: summary }))
  vi.mocked(useExpenseMonthlySummary).mockReturnValue(mockQueryResult({ data: monthlySummary }))
})

describe('ReportsView', () => {
  it('defaults to categories not excluded from Total, matching the Dashboard', () => {
    render(<ReportsView />)

    // Food (not excluded) is selected by default and shows in the table;
    // Payment/Refund (exclude_from_total: true) starts deselected.
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2) // header + Food only
    expect(screen.getByRole('cell', { name: 'Food' })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'Payment/Refund' })).not.toBeInTheDocument()
    // "Selected total" and the table's Total column both show it.
    expect(screen.getAllByText('R$ 150,00')).toHaveLength(2)
  })

  it('checking an excluded category adds it to the table', async () => {
    const user = userEvent.setup()
    render(<ReportsView />)

    await user.click(screen.getByRole('checkbox', { name: 'Payment/Refund' }))

    expect(screen.getByRole('cell', { name: 'Payment/Refund' })).toBeInTheDocument()
  })

  it('shows an empty-state message once every category is deselected', async () => {
    const user = userEvent.setup()
    render(<ReportsView />)

    await user.click(screen.getByText('Deselect all'))

    expect(
      screen.getByText('No expenses for the selected categories and date range.'),
    ).toBeInTheDocument()
  })

  it('"By month" mode groups the selected categories into one row per month', async () => {
    const user = userEvent.setup()
    render(<ReportsView />)

    await user.click(screen.getByRole('button', { name: 'By month' }))

    // Food-only total (Payment/Refund starts excluded): 100 in July, 50 in August.
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3) // header + July + August
    expect(screen.getByRole('cell', { name: '07/2026' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '08/2026' })).toBeInTheDocument()
    expect(screen.getByText('R$ 100,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument()
  })

  it('"By month" mode sums selected categories that share a month', async () => {
    const user = userEvent.setup()
    render(<ReportsView />)

    await user.click(screen.getByRole('button', { name: 'By month' }))
    await user.click(screen.getByRole('checkbox', { name: 'Payment/Refund' }))

    // August now sums Food (50) + Payment/Refund (2000) = 2050.
    const augustRow = screen.getByRole('cell', { name: '08/2026' }).closest('tr')
    expect(augustRow).not.toBeNull()
    expect(augustRow).toHaveTextContent('R$ 2.050,00')
  })

  it('"By category & month" mode renders one row per category with a month column each', async () => {
    const user = userEvent.setup()
    render(<ReportsView />)

    await user.click(screen.getByRole('button', { name: 'By category & month' }))

    // Only Food is selected by default: one data row, July/August columns, row total 150.
    const foodRow = screen.getByRole('cell', { name: 'Food' }).closest('tr')
    expect(foodRow).not.toBeNull()
    expect(foodRow).toHaveTextContent('R$ 100,00')
    expect(foodRow).toHaveTextContent('R$ 50,00')
    expect(foodRow).toHaveTextContent('R$ 150,00')
    // Footer total row mirrors the "By month" per-month totals.
    const footerRow = screen.getByRole('row', { name: /^Total/ })
    expect(footerRow).toHaveTextContent('R$ 100,00')
    expect(footerRow).toHaveTextContent('R$ 50,00')
  })

  it('"By category & month" mode shows an empty cell for a category with no spend in a given month', async () => {
    const user = userEvent.setup()
    render(<ReportsView />)

    await user.click(screen.getByRole('button', { name: 'By category & month' }))
    await user.click(screen.getByRole('checkbox', { name: 'Payment/Refund' }))

    // Payment/Refund only has an August total -- July should render as an empty dash.
    const paymentRow = screen.getByRole('cell', { name: 'Payment/Refund' }).closest('tr')
    expect(paymentRow).not.toBeNull()
    expect(paymentRow).toHaveTextContent('—')
    expect(paymentRow).toHaveTextContent('R$ 2.000,00')
  })
})
