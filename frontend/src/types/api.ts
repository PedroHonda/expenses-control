// Mirrors backend/app/schemas/{expense,category}.py exactly -- field names
// and optionality here must match the Pydantic models. Dates/datetimes are
// plain strings (ISO 8601), since that's what actually crosses the wire as
// JSON; nothing here parses them into Date objects.

export interface Category {
  id: string
  name: string
  is_default: boolean
  exclude_from_total: boolean
}

export interface ExpenseCreate {
  date: string
  title: string
  value: number
  category: string
  details?: string | null
  trip?: string | null
}

export interface ExpenseResponse extends ExpenseCreate {
  id: string
  created_at: string
  updated_at: string
}

export interface ExpenseListResponse {
  items: ExpenseResponse[]
  total: number
}

export interface ParsedExpenseRow {
  row_index: number
  date: string | null
  title: string | null
  value: number | null
  category: string | null
  details: string | null
  trip: string | null
  missing_required: string[]
  parse_errors: string[]
  raw: Record<string, string>
  is_duplicate: boolean
}

export interface CSVParseResponse {
  filename: string
  detected_columns: string[]
  unmapped_columns: string[]
  rows: ParsedExpenseRow[]
}

export interface ImportBatchRowError {
  index: number
  errors: string[]
}

export interface ImportBatchResponse {
  created: ExpenseResponse[]
  count: number
}
