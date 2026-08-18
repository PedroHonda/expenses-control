import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatCurrency, formatDate, todayIso } from './format'

describe('formatCurrency', () => {
  it('formats a positive number as BRL', () => {
    // pt-BR currency formatting may use a non-breaking space between the
    // symbol and the number depending on ICU data -- \s matches that too.
    expect(formatCurrency(15.5)).toMatch(/^R\$\s?15,50$/)
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toMatch(/^R\$\s?0,00$/)
  })

  it('uses a comma as the decimal separator and a period for thousands', () => {
    expect(formatCurrency(2662.02)).toMatch(/^R\$\s?2\.662,02$/)
  })
})

describe('formatDate', () => {
  it('formats an ISO date as DD/MM/YYYY', () => {
    expect(formatDate('2026-08-01')).toBe('01/08/2026')
  })

  it('does not shift the day due to UTC/local timezone conversion', () => {
    // The whole point of appending T00:00:00 in the implementation is that
    // this must render as the 1st, not the 31st of the previous month, in
    // any timezone behind UTC.
    expect(formatDate('2026-08-01')).not.toBe('31/07/2026')
  })
})

describe('todayIso', () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    process.env.TZ = originalTz
    vi.useRealTimers()
  })

  it('returns the local calendar date, not the UTC date', () => {
    // Regression test for a real bug: an earlier implementation used
    // `new Date().toISOString().slice(0, 10)`, which is always UTC and so
    // returns tomorrow's date for part of every day in timezones behind
    // UTC. 01:00 UTC on the 18th is still 22:00 on the 17th in UTC-3.
    process.env.TZ = 'America/Sao_Paulo'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-18T01:00:00Z'))

    expect(todayIso()).toBe('2026-08-17')
  })

  it('zero-pads single-digit months and days', () => {
    process.env.TZ = 'America/Sao_Paulo'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T12:00:00Z'))

    expect(todayIso()).toBe('2026-01-05')
  })
})
