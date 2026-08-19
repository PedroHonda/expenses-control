import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseForm } from './ExpenseForm'
import { useCreateExpense } from '../hooks/useExpenses'
import { useCategories, useCreateCategory } from '../hooks/useCategories'
import { mockMutationResult, mockQueryResult } from '../test/mockHooks'
import type { Category } from '../types/api'

vi.mock('../hooks/useExpenses')
vi.mock('../hooks/useCategories')

const categories: Category[] = [
  { id: '1', name: 'Food', is_default: true, exclude_from_total: false },
]

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
  vi.mocked(useCreateCategory).mockReturnValue(mockMutationResult())
  vi.mocked(useCreateExpense).mockReturnValue(mockMutationResult())
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
})
