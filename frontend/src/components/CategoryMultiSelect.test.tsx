import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryMultiSelect } from './CategoryMultiSelect'
import { useCategories } from '../hooks/useCategories'
import { mockQueryResult } from '../test/mockHooks'
import type { Category } from '../types/api'

vi.mock('../hooks/useCategories')

const categories: Category[] = [
  { id: '1', name: 'Food', is_default: true, exclude_from_total: false },
  { id: '2', name: 'Payment/Refund', is_default: true, exclude_from_total: true },
]

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
})

describe('CategoryMultiSelect', () => {
  it('checks only the categories present in `selected`', () => {
    render(<CategoryMultiSelect selected={new Set(['Food'])} onChange={vi.fn()} />)

    const checkboxes = screen.getAllByRole<HTMLInputElement>('checkbox')
    expect(checkboxes[0].checked).toBe(true)
    expect(checkboxes[1].checked).toBe(false)
  })

  it('clicking a checked category removes it from the selection', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryMultiSelect selected={new Set(['Food'])} onChange={onChange} />)

    await user.click(screen.getAllByRole('checkbox')[0])

    expect(onChange).toHaveBeenCalledWith(new Set())
  })

  it('clicking an unchecked category adds it to the selection', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryMultiSelect selected={new Set(['Food'])} onChange={onChange} />)

    await user.click(screen.getAllByRole('checkbox')[1])

    expect(onChange).toHaveBeenCalledWith(new Set(['Food', 'Payment/Refund']))
  })

  it('"Select all" selects every category', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryMultiSelect selected={new Set()} onChange={onChange} />)

    await user.click(screen.getByText('Select all'))

    expect(onChange).toHaveBeenCalledWith(new Set(['Food', 'Payment/Refund']))
  })

  it('"Deselect all" clears the selection', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <CategoryMultiSelect selected={new Set(['Food', 'Payment/Refund'])} onChange={onChange} />,
    )

    await user.click(screen.getByText('Deselect all'))

    expect(onChange).toHaveBeenCalledWith(new Set())
  })
})
