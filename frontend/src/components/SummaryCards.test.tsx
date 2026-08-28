import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryCards } from './SummaryCards'
import { useExpenses } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import { mockQueryResult } from '../test/mockHooks'
import type { Category, ExpenseListResponse, ExpenseResponse } from '../types/api'

vi.mock('../hooks/useExpenses')
vi.mock('../hooks/useCategories')

const categories: Category[] = [
  { id: '1', name: 'Food', is_default: true, exclude_from_total: false },
  { id: '2', name: 'Payment/Refund', is_default: true, exclude_from_total: true },
]

function makeExpense(overrides: Partial<ExpenseResponse>): ExpenseResponse {
  return {
    id: '1',
    date: '2026-08-01',
    title: 'Item',
    value: 0,
    category: 'Food',
    payment_method: 'Nubank',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
})

describe('SummaryCards', () => {
  it('excludes categories marked exclude_from_total from the Total', () => {
    const items = [
      makeExpense({ id: '1', value: 100, category: 'Food' }),
      makeExpense({ id: '2', value: 500, category: 'Payment/Refund' }),
    ]
    const data: ExpenseListResponse = { items, total: 2 }
    vi.mocked(useExpenses).mockReturnValue(mockQueryResult({ data }))

    render(<SummaryCards filters={{}} />)

    expect(screen.getByText(/^R\$\s?100,00$/)).toBeInTheDocument()
  })

  it('still counts excluded-category expenses in Count', () => {
    const items = [
      makeExpense({ id: '1', value: 100, category: 'Food' }),
      makeExpense({ id: '2', value: 500, category: 'Payment/Refund' }),
    ]
    const data: ExpenseListResponse = { items, total: 2 }
    vi.mocked(useExpenses).mockReturnValue(mockQueryResult({ data }))

    render(<SummaryCards filters={{}} />)

    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
