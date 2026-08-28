import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CsvReviewTable } from './CsvReviewTable'
import { useImportBatch } from '../hooks/useCsvImport'
import { useCategories, useCreateCategory } from '../hooks/useCategories'
import { useCreatePaymentMethod, usePaymentMethods } from '../hooks/usePaymentMethods'
import { mockMutationResult, mockQueryResult } from '../test/mockHooks'
import type { Category, CSVParseResponse, PaymentMethod } from '../types/api'

vi.mock('../hooks/useCsvImport')
vi.mock('../hooks/useCategories')
vi.mock('../hooks/usePaymentMethods')

const categories: Category[] = [
  { id: '1', name: 'Food', is_default: true, exclude_from_total: false },
  { id: '2', name: 'Shopping', is_default: true, exclude_from_total: false },
  { id: '3', name: 'Payment/Refund', is_default: true, exclude_from_total: true },
]

const paymentMethods: PaymentMethod[] = [
  { id: 'p1', name: 'Nubank', is_default: true, is_default_for_import: true },
  { id: 'p2', name: 'Pix', is_default: true, is_default_for_import: false },
]

// Mirrors what the backend actually returns for
// tests/fixtures/sample_bank_export.csv: two purchase rows missing a
// category, and a negative-amount row already auto-categorized. Every row's
// payment_method already comes pre-filled with the CSV-import default
// (Nubank) -- see the upload-csv route's default-fill pass (spec 08 §2.3).
// Each row therefore contributes TWO comboboxes to the table in DOM order:
// category first, then payment method -- e.g. row 1 is combobox indexes
// [0, 1], row 2 is [2, 3], row 3 is [4, 5].
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
      payment_method: 'Nubank',
      details: null,
      trip: null,
      missing_required: ['category'],
      parse_errors: [],
      raw: {},
      is_duplicate: false,
    },
    {
      row_index: 1,
      date: '2026-08-02',
      title: 'Test Merchant B',
      value: 204.27,
      category: null,
      payment_method: 'Nubank',
      details: null,
      trip: null,
      missing_required: ['category'],
      parse_errors: [],
      raw: {},
      is_duplicate: false,
    },
    {
      row_index: 2,
      date: '2026-08-03',
      title: 'Bill Payment',
      value: 2403.28,
      category: 'Payment/Refund',
      payment_method: 'Nubank',
      details: null,
      trip: null,
      missing_required: [],
      parse_errors: [],
      raw: {},
      is_duplicate: false,
    },
  ],
}

beforeEach(() => {
  vi.mocked(useCategories).mockReturnValue(mockQueryResult({ data: categories }))
  vi.mocked(useCreateCategory).mockReturnValue(mockMutationResult())
  vi.mocked(usePaymentMethods).mockReturnValue(mockQueryResult({ data: paymentMethods }))
  vi.mocked(useCreatePaymentMethod).mockReturnValue(mockMutationResult())
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

    // Row 1's category select (index 0), then row 2's (index 2) -- index 1
    // is row 1's payment method select, already filled with the default.
    const comboboxes = screen.getAllByRole('combobox')
    await user.selectOptions(comboboxes[0], 'Food')
    expect(submitButton).toBeDisabled()

    await user.selectOptions(comboboxes[2], 'Shopping')
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
    const comboboxes = screen.getAllByRole('combobox')
    await user.selectOptions(comboboxes[2], 'Shopping') // row 1's category select

    await user.click(screen.getByRole('button', { name: /Submit 2 expenses/ }))

    expect(mutate).toHaveBeenCalledTimes(1)
    const [payload] = mutate.mock.calls[0] as [
      { value: number; category: string; payment_method: string }[],
    ]
    expect(payload).toHaveLength(2)
    expect(payload[0]).toMatchObject({
      value: 204.27,
      category: 'Shopping',
      payment_method: 'Nubank',
    })
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

    const comboboxes = screen.getAllByRole('combobox')
    await user.selectOptions(comboboxes[0], 'Food') // row 0's category select
    await user.selectOptions(comboboxes[2], 'Shopping') // row 1's category select
    await user.click(screen.getByRole('button', { name: /Submit 3 expenses/ }))

    expect(screen.getByText('Imported 3 expenses.')).toBeInTheDocument()
  })

  it('unchecks a duplicate row by default and flags it with a warning', () => {
    vi.mocked(useImportBatch).mockReturnValue(mockMutationResult())
    const duplicateResult: CSVParseResponse = {
      ...parseResult,
      rows: [...parseResult.rows.slice(0, 2), { ...parseResult.rows[2], is_duplicate: true }],
    }
    render(<CsvReviewTable parseResult={duplicateResult} onDone={vi.fn()} />)

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[2]).not.toBeChecked()
    expect(checkboxes[2].closest('span')).toHaveAttribute(
      'title',
      expect.stringContaining('Possible duplicate'),
    )
    // The other rows are untouched.
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).toBeChecked()
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
    await user.selectOptions(screen.getAllByRole('combobox')[2], 'Shopping') // row 1's category select
    await user.click(screen.getByRole('button', { name: /Submit 2 expenses/ }))

    expect(screen.getByText(/Row 3:.*unknown category: 'X'/)).toBeInTheDocument()
  })
})
