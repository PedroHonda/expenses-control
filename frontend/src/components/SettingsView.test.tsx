import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsView } from './SettingsView'
import { useCategories, useCreateCategory, useUpdateCategory } from '../hooks/useCategories'
import {
  useCreatePaymentMethod,
  usePaymentMethods,
  useSetDefaultImportPaymentMethod,
} from '../hooks/usePaymentMethods'
import { mockMutationResult, mockQueryResult } from '../test/mockHooks'
import type { Category, PaymentMethod } from '../types/api'

vi.mock('../hooks/useCategories')
vi.mock('../hooks/usePaymentMethods')

const categories: Category[] = [
  { id: '1', name: 'Food', is_default: true, exclude_from_total: false },
  { id: '2', name: 'Payment/Refund', is_default: true, exclude_from_total: true },
]

const paymentMethods: PaymentMethod[] = [
  { id: 'p1', name: 'Nubank', is_default: true, is_default_for_import: true },
  { id: 'p2', name: 'Pix', is_default: true, is_default_for_import: false },
]

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
  vi.mocked(usePaymentMethods).mockReturnValue(mockQueryResult({ data: paymentMethods }))
  vi.mocked(useSetDefaultImportPaymentMethod).mockReturnValue(mockMutationResult())
  vi.mocked(useCreatePaymentMethod).mockReturnValue(mockMutationResult())
  vi.mocked(useCreateCategory).mockReturnValue(mockMutationResult())
})

describe('SettingsView', () => {
  it('renders one checkbox per category, checked to match exclude_from_total', () => {
    vi.mocked(useUpdateCategory).mockReturnValue(mockMutationResult())
    render(<SettingsView />)

    const checkboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0].checked).toBe(false)
    expect(checkboxes[1].checked).toBe(true)
  })

  it('toggling a checkbox calls the update mutation with the category id', async () => {
    const mutate = vi.fn()
    vi.mocked(useUpdateCategory).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<SettingsView />)

    await user.click(screen.getAllByRole('checkbox')[0])

    expect(mutate).toHaveBeenCalledWith({ id: '1', exclude_from_total: true })
  })

  it('submits the new-category form with the trimmed name', async () => {
    const mutate = vi.fn()
    vi.mocked(useCreateCategory).mockReturnValue(mockMutationResult({ mutate }))
    vi.mocked(useUpdateCategory).mockReturnValue(mockMutationResult())
    const user = userEvent.setup()
    render(<SettingsView />)

    await user.type(screen.getByPlaceholderText('New category name'), '  Transport  ')
    await user.click(screen.getByRole('button', { name: 'Add Category' }))

    expect(mutate).toHaveBeenCalledWith('Transport', expect.anything())
  })

  it('renders one radio per payment method, checked to match is_default_for_import', () => {
    render(<SettingsView />)

    const radios = screen.getAllByRole<HTMLInputElement>('radio')
    expect(radios).toHaveLength(2)
    expect(radios[0].checked).toBe(true) // Nubank
    expect(radios[1].checked).toBe(false) // Pix
  })

  it('picking a different payment method calls the set-default mutation with its id', async () => {
    const mutate = vi.fn()
    vi.mocked(useSetDefaultImportPaymentMethod).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<SettingsView />)

    await user.click(screen.getAllByRole('radio')[1]) // Pix

    expect(mutate).toHaveBeenCalledWith('p2')
  })

  it('submits the new-payment-method form with the trimmed name', async () => {
    const mutate = vi.fn()
    vi.mocked(useCreatePaymentMethod).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<SettingsView />)

    await user.type(screen.getByPlaceholderText('New payment method name'), '  Cash  ')
    await user.click(screen.getByRole('button', { name: 'Add Payment Method' }))

    expect(mutate).toHaveBeenCalledWith('Cash', expect.anything())
  })
})
