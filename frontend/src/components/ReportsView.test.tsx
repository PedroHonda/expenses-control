import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportsView } from './ReportsView'
import { useCategories } from '../hooks/useCategories'
import { useExpenseSummary } from '../hooks/useExpenses'
import { mockQueryResult } from '../test/mockHooks'
import type { Category, ExpenseSummaryResponse } from '../types/api'

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

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
  vi.mocked(useExpenseSummary).mockReturnValue(mockQueryResult({ data: summary }))
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
})
