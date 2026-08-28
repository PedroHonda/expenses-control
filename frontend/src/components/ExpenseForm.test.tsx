import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseForm } from './ExpenseForm'
import { useCreateExpense, useUpdateExpense } from '../hooks/useExpenses'
import { useCategories, useCreateCategory } from '../hooks/useCategories'
import { useCreatePaymentMethod, usePaymentMethods } from '../hooks/usePaymentMethods'
import { mockMutationResult, mockQueryResult } from '../test/mockHooks'
import type { Category, ExpenseResponse, PaymentMethod } from '../types/api'

vi.mock('../hooks/useExpenses')
vi.mock('../hooks/useCategories')
vi.mock('../hooks/usePaymentMethods')

const categories: Category[] = [
  { id: '1', name: 'Food', is_default: true, exclude_from_total: false },
]

const paymentMethods: PaymentMethod[] = [
  { id: 'p1', name: 'Nubank', is_default: true, is_default_for_import: true },
  { id: 'p2', name: 'Pix', is_default: true, is_default_for_import: false },
]

const existingExpense: ExpenseResponse = {
  id: 'e1',
  date: '2026-08-10',
  title: 'Groceries',
  value: 55,
  category: 'Food',
  payment_method: 'Pix',
  details: null,
  trip: null,
  created_at: '2026-08-10T00:00:00Z',
  updated_at: '2026-08-10T00:00:00Z',
}

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
  vi.mocked(useCreateCategory).mockReturnValue(mockMutationResult())
  vi.mocked(usePaymentMethods).mockReturnValue(mockQueryResult({ data: paymentMethods }))
  vi.mocked(useCreatePaymentMethod).mockReturnValue(mockMutationResult())
  vi.mocked(useCreateExpense).mockReturnValue(mockMutationResult())
  vi.mocked(useUpdateExpense).mockReturnValue(mockMutationResult())
})

describe('ExpenseForm', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ExpenseForm open={false} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('disables Save until a category is chosen', async () => {
    const user = userEvent.setup()
    render(<ExpenseForm open onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Category'), 'Food')

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('submits a trimmed, correctly-typed payload', async () => {
    const mutate = vi.fn()
    vi.mocked(useCreateExpense).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<ExpenseForm open onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Title'), '  Coffee  ')
    await user.type(screen.getByLabelText('Value'), '12.5')
    await user.selectOptions(screen.getByLabelText('Category'), 'Food')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledTimes(1)
    const [payload] = mutate.mock.calls[0] as [Record<string, unknown>]
    expect(payload).toMatchObject({ title: 'Coffee', value: 12.5, category: 'Food' })
  })

  it('defaults Payment Method to the CSV-import default and submits it untouched', async () => {
    const mutate = vi.fn()
    vi.mocked(useCreateExpense).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<ExpenseForm open onClose={vi.fn()} />)

    // Nubank is flagged is_default_for_import in the mocked list above --
    // the field should start on it without the user picking anything.
    expect(screen.getByLabelText('Payment Method')).toHaveValue('Nubank')

    await user.type(screen.getByLabelText('Title'), 'Coffee')
    await user.type(screen.getByLabelText('Value'), '12.5')
    await user.selectOptions(screen.getByLabelText('Category'), 'Food')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const [payload] = mutate.mock.calls[0] as [Record<string, unknown>]
    expect(payload).toMatchObject({ payment_method: 'Nubank' })
  })

  it('shows the backend error message on failure', () => {
    vi.mocked(useCreateExpense).mockReturnValue(
      mockMutationResult({
        isError: true,
        error: {
          isAxiosError: true,
          message: 'Request failed',
          response: { data: { detail: "unknown category: 'X'" } },
        },
      }),
    )
    render(<ExpenseForm open onClose={vi.fn()} />)

    expect(screen.getByText("unknown category: 'X'")).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ExpenseForm open onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('prefills fields and titles itself "Edit Expense" when given an expense', () => {
    render(<ExpenseForm open onClose={vi.fn()} expense={existingExpense} />)

    expect(screen.getByText('Edit Expense')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Groceries')
    expect(screen.getByLabelText('Value')).toHaveValue(55)
    // The expense's own payment_method (Pix) wins over the CSV-import
    // default (Nubank) -- editing never silently overrides it.
    expect(screen.getByLabelText('Payment Method')).toHaveValue('Pix')
  })

  it('submits an edit via useUpdateExpense with the expense id', async () => {
    const mutate = vi.fn()
    vi.mocked(useUpdateExpense).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<ExpenseForm open onClose={vi.fn()} expense={existingExpense} />)

    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Groceries and snacks')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(mutate).toHaveBeenCalledTimes(1)
    const [variables] = mutate.mock.calls[0] as [{ id: string; expense: Record<string, unknown> }]
    expect(variables.id).toBe('e1')
    expect(variables.expense).toMatchObject({ title: 'Groceries and snacks', category: 'Food' })
  })
})
