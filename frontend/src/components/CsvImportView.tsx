import { useState } from 'react'
import { CsvDropzone } from './CsvDropzone'
import { CsvReviewTable } from './CsvReviewTable'
import type { CSVParseResponse } from '../types/api'

export function CsvImportView() {
  const [parseResult, setParseResult] = useState<CSVParseResponse | null>(null)

  if (parseResult === null) {
    return <CsvDropzone onParsed={setParseResult} />
  }

  return (
    <CsvReviewTable
      parseResult={parseResult}
      onDone={() => {
        setParseResult(null)
      }}
    />
  )
}
