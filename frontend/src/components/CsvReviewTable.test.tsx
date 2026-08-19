import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsvReviewTable } from './CsvReviewTable'
import { useImportBatch } from '../hooks/useCsvImport'
import { useCategories, useCreateCategory } from '../hooks/useCategories'
import { mockMutationResult, mockQueryResult } from '../test/mockHooks'
import type { Category, CSVParseResponse } from '../types/api'

vi.mock('../hooks/useCsvImport')
vi.mock('../hooks/useCategories')

const categories: Category[] = [
  { id: '1', name: 'Food', is_default: true, exclude_from_total: false },
  { id: '2', name: 'Shopping', is_default: true, exclude_from_total: false },
  { id: '3', name: 'Payment/Refund', is_default: true, exclude_from_total: true },
]

// Mirrors what the backend actually returns for
// tests/fixtures/sample_bank_export.csv: two purchase rows missing a
// category, and a negative-amount row already auto-categorized.
const parseResult: CSVParseResponse = {
  filename: 'sample_bank_export.csv',
  detected_columns: ['date', 'title', 'value'],
  unmapped_columns: [],
  rows: [
    {
      row_index: 0,
      date: '2026-08-01',
      title: 'Test Merchant A',
      value: 38.97,
      category: null,
      details: null,
      trip: null,
      missing_required: ['category'],
      parse_errors: [],
      raw: {},
    },
    {
      row_index: 1,
      date: '2026-08-02',
      title: 'Test Merchant B',
      value: 204.27,
      category: null,
      details: null,
      trip: null,
      missing_required: ['category'],
      parse_errors: [],
      raw: {},
    },
    {
      row_index: 2,
      date: '2026-08-03',
      title: 'Bill Payment',
      value: 2403.28,
      category: 'Payment/Refund',
      details: null,
      trip: null,
      missing_required: [],
      parse_errors: [],
      raw: {},
    },
  ],
}

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
  vi.mocked(useCreateCategory).mockReturnValue(mockMutationResult())
})

describe('CsvReviewTable', () => {
  it('pre-selects the auto-categorized row and leaves the others empty', () => {
    vi.mocked(useImportBatch).mockReturnValue(mockMutationResult())
    render(<CsvReviewTable parseResult={parseResult} onDone={vi.fn()} />)

    expect(screen.getByDisplayValue('Payment/Refund')).toBeInTheDocument()
    // Two rows still show the placeholder ("Select a category") option.
    expect(screen.getAllByDisplayValue('Select a category')).toHaveLength(2)
  })

  it('disables submit until every included row has a category', async () => {
    vi.mocked(useImportBatch).mockReturnValue(mockMutationResult())
    const user = userEvent.setup()
    render(<CsvReviewTable parseResult={parseResult} onDone={vi.fn()} />)

    const submitButton = screen.getByRole('button', { name: /Submit 3 expenses/ })
    expect(submitButton).toBeDisabled()

    const categorySelects = screen.getAllByRole('combobox')
    await user.selectOptions(categorySelects[0], 'Food')
    expect(submitButton).toBeDisabled()

    await user.selectOptions(categorySelects[1], 'Shopping')
    expect(submitButton).toBeEnabled()
  })

  it('excluding a row removes it from the submitted count and unblocks submit', async () => {
    vi.mocked(useImportBatch).mockReturnValue(mockMutationResult())
    const user = userEvent.setup()
    render(<CsvReviewTable parseResult={parseResult} onDone={vi.fn()} />)

    // Exclude the two rows that are missing a category, leaving only the
    // already-complete Payment/Refund row -- submit should now be enabled
    // with count 1, with no category selections needed.
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])

    expect(screen.getByRole('button', { name: 'Submit 1 expense' })).toBeEnabled()
  })

  it('submits only the included rows with numeric values and trimmed strings', async () => {
    const mutate = vi.fn()
    vi.mocked(useImportBatch).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<CsvReviewTable parseResult={parseResult} onDone={vi.fn()} />)

    await user.click(screen.getAllByRole('checkbox')[0]) // exclude row 0
    const categorySelects = screen.getAllByRole('combobox')
    await user.selectOptions(categorySelects[1], 'Shopping')

    await user.click(screen.getByRole('button', { name: /Submit 2 expenses/ }))

    expect(mutate).toHaveBeenCalledTimes(1)
    const [payload] = mutate.mock.calls[0] as [{ value: number; category: string }[]]
    expect(payload).toHaveLength(2)
    expect(payload[0]).toMatchObject({ value: 204.27, category: 'Shopping' })
    expect(payload[1]).toMatchObject({ value: 2403.28, category: 'Payment/Refund' })
  })

  it('shows "Imported N expenses" after a successful submit', async () => {
    const mutate = vi.fn(
      (
        _payload: unknown,
        options?: { onSuccess?: (data: { created: unknown[]; count: number }) => void },
      ) => {
        options?.onSuccess?.({ created: [], count: 3 })
      },
    )
    vi.mocked(useImportBatch).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<CsvReviewTable parseResult={parseResult} onDone={vi.fn()} />)

    const categorySelects = screen.getAllByRole('combobox')
    await user.selectOptions(categorySelects[0], 'Food')
    await user.selectOptions(categorySelects[1], 'Shopping')
    await user.click(screen.getByRole('button', { name: /Submit 3 expenses/ }))

    expect(screen.getByText('Imported 3 expenses.')).toBeInTheDocument()
  })

  it('maps a batch-index validation error back to the correct original row', async () => {
    // Row 0 gets excluded, so the submitted batch is [row1, row2] -- a
    // failure at submitted-index 1 must highlight row2 (Bill Payment),
    // not row1, since batch index and original row index diverge once
    // any row is excluded.
    const mutate = vi.fn((_payload: unknown, options?: { onError?: (error: unknown) => void }) => {
      options?.onError?.({
        isAxiosError: true,
        message: 'Request failed',
        response: { data: { detail: [{ index: 1, errors: ["unknown category: 'X'"] }] } },
      })
    })
    vi.mocked(useImportBatch).mockReturnValue(mockMutationResult({ mutate }))
    const user = userEvent.setup()
    render(<CsvReviewTable parseResult={parseResult} onDone={vi.fn()} />)

    await user.click(screen.getAllByRole('checkbox')[0]) // exclude row 0
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'Shopping')
    await user.click(screen.getByRole('button', { name: /Submit 2 expenses/ }))

    expect(screen.getByText(/Row 3:.*unknown category: 'X'/)).toBeInTheDocument()
  })
})
