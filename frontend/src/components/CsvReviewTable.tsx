import { useState } from 'react'
import { useImportBatch } from '../hooks/useCsvImport'
import { getErrorMessage, getImportBatchRowErrors } from '../lib/errors'
import { CategorySelect } from './CategorySelect'
import type {
  CSVParseResponse,
  ExpenseCreate,
  ImportBatchResponse,
  ParsedExpenseRow,
} from '../types/api'

interface CsvReviewTableProps {
  parseResult: CSVParseResponse
  onDone: () => void
}

interface EditableRow {
  rowIndex: number
  date: string
  title: string
  value: string
  category: string
  details: string
  trip: string
  excluded: boolean
  isDuplicate: boolean
  parseErrors: string[]
  submitError: string | null
}

const DUPLICATE_WARNING =
  'Possible duplicate: an expense with the same date, title, and value already exists. Excluded by default -- check the box to import it anyway.'

function toEditableRow(row: ParsedExpenseRow): EditableRow {
  return {
    rowIndex: row.row_index,
    date: row.date ?? '',
    title: row.title ?? '',
    value: row.value !== null ? String(row.value) : '',
    category: row.category ?? '',
    details: row.details ?? '',
    trip: row.trip ?? '',
    excluded: row.is_duplicate,
    isDuplicate: row.is_duplicate,
    parseErrors: row.parse_errors,
    submitError: null,
  }
}

function isRowIncomplete(row: EditableRow): boolean {
  return row.date === '' || row.title === '' || row.value === '' || row.category === ''
}

function rowMessages(row: EditableRow): string[] {
  return row.submitError !== null ? [...row.parseErrors, row.submitError] : row.parseErrors
}

function updateRow(
  rows: EditableRow[],
  rowIndex: number,
  patch: Partial<EditableRow>,
): EditableRow[] {
  return rows.map((row) => (row.rowIndex === rowIndex ? { ...row, ...patch } : row))
}

export function CsvReviewTable({ parseResult, onDone }: CsvReviewTableProps) {
  const [rows, setRows] = useState<EditableRow[]>(() => parseResult.rows.map(toEditableRow))
  const [result, setResult] = useState<ImportBatchResponse | null>(null)
  const importBatch = useImportBatch()

  const includedRows = rows.filter((row) => !row.excluded)
  const canSubmit = includedRows.length > 0 && includedRows.every((row) => !isRowIncomplete(row))

  function handleSubmit() {
    const includedRowIndexes = includedRows.map((row) => row.rowIndex)
    const payload: ExpenseCreate[] = includedRows.map((row) => ({
      date: row.date,
      title: row.title.trim(),
      value: Number(row.value),
      category: row.category,
      details: row.details.trim() === '' ? null : row.details.trim(),
      trip: row.trip.trim() === '' ? null : row.trip.trim(),
    }))

    setRows((prev) => prev.map((row) => ({ ...row, submitError: null })))

    importBatch.mutate(payload, {
      onSuccess: (response) => {
        setResult(response)
      },
      onError: (error: unknown) => {
        const rowErrors = getImportBatchRowErrors(error)
        if (rowErrors === null) return
        const errorsByRowIndex = new Map(
          rowErrors.map((rowError) => [
            includedRowIndexes[rowError.index],
            rowError.errors.join('; '),
          ]),
        )
        setRows((prev) =>
          prev.map((row) => ({
            ...row,
            submitError: errorsByRowIndex.get(row.rowIndex) ?? null,
          })),
        )
      },
    })
  }

  if (result !== null) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-lg font-medium text-slate-900">
          Imported {result.count} expense{result.count === 1 ? '' : 's'}.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Done
        </button>
      </div>
    )
  }

  const flaggedRows = rows.filter((row) => !row.excluded && rowMessages(row).length > 0)
  const genericError =
    importBatch.isError && getImportBatchRowErrors(importBatch.error) === null
      ? getErrorMessage(importBatch.error)
      : null

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2">Include</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-3 py-2">Trip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const incomplete = !row.excluded && isRowIncomplete(row)
                return (
                  <tr
                    key={row.rowIndex}
                    className={row.excluded ? 'opacity-40' : incomplete ? 'bg-amber-50' : undefined}
                  >
                    <td className="px-3 py-2">
                      <span title={row.isDuplicate ? DUPLICATE_WARNING : undefined}>
                        <input
                          type="checkbox"
                          checked={!row.excluded}
                          onChange={(event) => {
                            setRows((prev) =>
                              updateRow(prev, row.rowIndex, { excluded: !event.target.checked }),
                            )
                          }}
                          aria-label={`Include row ${String(row.rowIndex + 1)}`}
                        />
                        {row.isDuplicate && (
                          <span className="ml-1 text-amber-600" aria-hidden="true">
                            ⚠
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.date}
                        disabled={row.excluded}
                        onChange={(event) => {
                          setRows((prev) =>
                            updateRow(prev, row.rowIndex, { date: event.target.value }),
                          )
                        }}
                        className="w-36 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.title}
                        disabled={row.excluded}
                        onChange={(event) => {
                          setRows((prev) =>
                            updateRow(prev, row.rowIndex, { title: event.target.value }),
                          )
                        }}
                        className="w-40 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={row.value}
                        disabled={row.excluded}
                        onChange={(event) => {
                          setRows((prev) =>
                            updateRow(prev, row.rowIndex, { value: event.target.value }),
                          )
                        }}
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <CategorySelect
                        value={row.category}
                        onChange={(value) => {
                          setRows((prev) => updateRow(prev, row.rowIndex, { category: value }))
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.details}
                        disabled={row.excluded}
                        onChange={(event) => {
                          setRows((prev) =>
                            updateRow(prev, row.rowIndex, { details: event.target.value }),
                          )
                        }}
                        className="w-32 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.trip}
                        disabled={row.excluded}
                        onChange={(event) => {
                          setRows((prev) =>
                            updateRow(prev, row.rowIndex, { trip: event.target.value }),
                          )
                        }}
                        className="w-32 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {flaggedRows.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-rose-600">
          {flaggedRows.map((row) => (
            <li key={row.rowIndex}>
              Row {row.rowIndex + 1}: {rowMessages(row).join('; ')}
            </li>
          ))}
        </ul>
      )}

      {genericError !== null && <p className="mt-2 text-sm text-rose-600">{genericError}</p>}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {includedRows.length} of {rows.length} row{rows.length === 1 ? '' : 's'} will be imported.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || importBatch.isPending}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {importBatch.isPending
              ? 'Importing…'
              : `Submit ${String(includedRows.length)} expense${includedRows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
