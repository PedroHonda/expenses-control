import { describe, expect, it } from 'vitest'
import { getErrorMessage, getImportBatchRowErrors } from './errors'

// axios.isAxiosError only checks the `isAxiosError` marker + shape at
// runtime, so a plain object is enough -- no need to construct a real
// AxiosError instance for these tests.
function fakeAxiosError(data: unknown, message = 'Request failed'): unknown {
  return { isAxiosError: true, message, response: { data } }
}

describe('getErrorMessage', () => {
  it('returns a string `detail` directly', () => {
    const error = fakeAxiosError({ detail: "unknown category: 'X'" })
    expect(getErrorMessage(error)).toBe("unknown category: 'X'")
  })

  it('summarizes an array `detail` (the import-batch shape) as a count', () => {
    const error = fakeAxiosError({
      detail: [
        { index: 0, errors: ['bad'] },
        { index: 2, errors: ['also bad'] },
      ],
    })
    expect(getErrorMessage(error)).toBe('2 row(s) failed validation')
  })

  it('falls back to the axios error message when there is no usable detail', () => {
    const error = fakeAxiosError(undefined, 'Network Error')
    expect(getErrorMessage(error)).toBe('Network Error')
  })

  it('handles a plain Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('handles a totally unrecognized thrown value', () => {
    expect(getErrorMessage('just a string, not an Error')).toBe('Something went wrong')
  })
})

describe('getImportBatchRowErrors', () => {
  it('extracts a valid row-error array', () => {
    const error = fakeAxiosError({ detail: [{ index: 1, errors: ['unknown category'] }] })
    expect(getImportBatchRowErrors(error)).toEqual([{ index: 1, errors: ['unknown category'] }])
  })

  it('returns null for a string `detail` (not the batch-error shape)', () => {
    const error = fakeAxiosError({ detail: 'plain message' })
    expect(getImportBatchRowErrors(error)).toBeNull()
  })

  it('returns null for an array that does not match the row-error shape', () => {
    const error = fakeAxiosError({ detail: ['just a string, not a row error'] })
    expect(getImportBatchRowErrors(error)).toBeNull()
  })

  it('returns null for a non-axios error', () => {
    expect(getImportBatchRowErrors(new Error('x'))).toBeNull()
  })
})
