// pt-BR/BRL: the sample data and target user are Brazilian (see
// samples/Nubank_2026-09-06.csv) -- not configurable yet, single-user app.

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(iso: string): string {
  // Append a time so this parses as local midnight, not UTC midnight --
  // otherwise `new Date('2026-08-01')` can display as 2026-07-31 in
  // timezones west of UTC.
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR')
}

/** Today's date as YYYY-MM-DD, in the browser's local timezone.
 *
 * NOT `new Date().toISOString().slice(0, 10)` -- toISOString() is always
 * UTC, so that expression returns tomorrow's date for part of every day in
 * any timezone ahead of UTC (confirmed live: this exact bug pre-filled
 * ExpenseForm's date field with the wrong day during manual testing). */
export function todayIso(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${String(year)}-${month}-${day}`
}
