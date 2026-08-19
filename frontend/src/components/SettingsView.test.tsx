import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsView } from './SettingsView'
import { useCategories, useUpdateCategory } from '../hooks/useCategories'
import { mockMutationResult, mockQueryResult } from '../test/mockHooks'
import type { Category } from '../types/api'

vi.mock('../hooks/useCategories')

const categories: Category[] = [
  { id: '1', name: 'Food', is_default: true, exclude_from_total: false },
  { id: '2', name: 'Payment/Refund', is_default: true, exclude_from_total: true },
]

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
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
})
