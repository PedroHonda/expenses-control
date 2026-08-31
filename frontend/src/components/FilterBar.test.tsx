import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from './FilterBar'
import { useCategories, useCreateCategory } from '../hooks/useCategories'
import { usePaymentMethods, useCreatePaymentMethod } from '../hooks/usePaymentMethods'
import { mockMutationResult, mockQueryResult } from '../test/mockHooks'
import type { Category, PaymentMethod } from '../types/api'

vi.mock('../hooks/useCategories')
vi.mock('../hooks/usePaymentMethods')

const categories: Category[] = [
  { id: '1', name: 'Uber', is_default: true, exclude_from_total: false },
  { id: '2', name: 'Food', is_default: true, exclude_from_total: false },
]

const paymentMethods: PaymentMethod[] = [
  { id: '1', name: 'Nubank', is_default: true, is_default_for_import: true },
  { id: '2', name: 'Pix', is_default: false, is_default_for_import: false },
]

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
  vi.mocked(useCreateCategory).mockReturnValue(mockMutationResult())
  vi.mocked(usePaymentMethods).mockReturnValue(mockQueryResult({ data: paymentMethods }))
  vi.mocked(useCreatePaymentMethod).mockReturnValue(mockMutationResult())
})

describe('FilterBar', () => {
  it('calls onChange with the selected category', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FilterBar filters={{}} onChange={onChange} />)

    await user.selectOptions(screen.getByLabelText('Category'), 'Uber')

    expect(onChange).toHaveBeenCalledWith({ category: 'Uber' })
  })

  it('calls onChange with the selected payment method', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FilterBar filters={{}} onChange={onChange} />)

    await user.selectOptions(screen.getByLabelText('Payment Method'), 'Pix')

    expect(onChange).toHaveBeenCalledWith({ paymentMethod: 'Pix' })
  })

  it('calls onChange with the trip text as typed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FilterBar filters={{}} onChange={onChange} />)

    await user.type(screen.getByLabelText('Trip'), 'X')

    expect(onChange).toHaveBeenCalledWith({ trip: 'X' })
  })

  it('shows "Clear filters" only once a filter is active', () => {
    const { rerender } = render(<FilterBar filters={{}} onChange={vi.fn()} />)
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()

    rerender(<FilterBar filters={{ category: 'Uber' }} onChange={vi.fn()} />)
    expect(screen.getByText('Clear filters')).toBeInTheDocument()
  })

  it('"Clear filters" resets to an empty filter object', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FilterBar filters={{ trip: 'Serra Trip' }} onChange={onChange} />)

    await user.click(screen.getByText('Clear filters'))

    expect(onChange).toHaveBeenCalledWith({})
  })
})
