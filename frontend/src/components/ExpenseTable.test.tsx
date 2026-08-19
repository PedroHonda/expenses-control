import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseTable } from './ExpenseTable'
import { useDeleteExpense, useExpenses } from '../hooks/useExpenses'
import { mockMutationResult, mockQueryResult } from '../test/mockHooks'
import type { ExpenseListResponse, ExpenseResponse } from '../types/api'

vi.mock('../hooks/useExpenses')

function makeExpense(overrides: Partial<ExpenseResponse> = {}): ExpenseResponse {
  return {
    id: '1',
    date: '2026-08-01',
    title: 'Coffee',
    value: 12.5,
    category: 'Food',
    details: null,
    trip: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

const confirmMock = vi.fn<(message?: string) => boolean>()

beforeEach(() => {
  vi.mocked(useDeleteExpense).mockReturnValue(mockMutationResult())
  confirmMock.mockReset().mockReturnValue(true)
  window.confirm = confirmMock
})

describe('ExpenseTable', () => {
  it('calls onEdit with the expense when its edit button is clicked', async () => {
    const expense = makeExpense()
    const data: ExpenseListResponse = { items: [expense], total: 1 }
    vi.mocked(useExpenses).mockReturnValue(mockQueryResult({ data }))
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<ExpenseTable filters={{}} onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: 'Edit Coffee' }))

    expect(onEdit).toHaveBeenCalledWith(expense)
  })

  it('deletes after confirmation', async () => {
    const expense = makeExpense()
    const data: ExpenseListResponse = { items: [expense], total: 1 }
    vi.mocked(useExpenses).mockReturnValue(mockQueryResult({ data }))
    const mutate = vi.fn()
    vi.mocked(useDeleteExpense).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<ExpenseTable filters={{}} onEdit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Delete Coffee' }))

    expect(confirmMock).toHaveBeenCalled()
    expect(mutate).toHaveBeenCalledWith('1')
  })

  it('does not delete when the confirmation is declined', async () => {
    confirmMock.mockReturnValue(false)
    const expense = makeExpense()
    const data: ExpenseListResponse = { items: [expense], total: 1 }
    vi.mocked(useExpenses).mockReturnValue(mockQueryResult({ data }))
    const mutate = vi.fn()
    vi.mocked(useDeleteExpense).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<ExpenseTable filters={{}} onEdit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Delete Coffee' }))

    expect(mutate).not.toHaveBeenCalled()
  })
})
