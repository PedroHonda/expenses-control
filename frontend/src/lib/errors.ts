import axios from 'axios'
import type { ImportBatchRowError } from '../types/api'

function isImportBatchRowError(value: unknown): value is ImportBatchRowError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'index' in value &&
    typeof value.index === 'number' &&
    'errors' in value &&
    Array.isArray(value.errors)
  )
}

function getResponseDetail(error: unknown): unknown {
  if (!axios.isAxiosError(error)) return undefined
  const data: unknown = error.response?.data
  if (typeof data !== 'object' || data === null || !('detail' in data)) return undefined
  return data.detail
}

/** A single human-readable message for toasts/inline error text. */
export function getErrorMessage(error: unknown): string {
  const detail = getResponseDetail(error)
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return `${String(detail.length)} row(s) failed validation`
  if (axios.isAxiosError(error)) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

/** The structured per-row errors from a failed import-batch call, if that's
 * what this error actually is -- used by CsvReviewTable to highlight rows. */
export function getImportBatchRowErrors(error: unknown): ImportBatchRowError[] | null {
  const detail = getResponseDetail(error)
  if (Array.isArray(detail) && detail.every(isImportBatchRowError)) {
    return detail
  }
  return null
}
