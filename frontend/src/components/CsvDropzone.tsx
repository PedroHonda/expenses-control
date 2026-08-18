import { useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import { useUploadCsv } from '../hooks/useCsvImport'
import { getErrorMessage } from '../lib/errors'
import type { CSVParseResponse } from '../types/api'

interface CsvDropzoneProps {
  onParsed: (result: CSVParseResponse) => void
}

export function CsvDropzone({ onParsed }: CsvDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadCsv = useUploadCsv()

  function handleFile(file: File) {
    setLocalError(null)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setLocalError('Only .csv files are accepted.')
      return
    }
    uploadCsv.mutate(file, {
      onSuccess: (result) => {
        onParsed(result)
      },
    })
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files.item(0)
    if (file !== null) handleFile(file)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      inputRef.current?.click()
    }
  }

  const errorToShow = localError ?? (uploadCsv.isError ? getErrorMessage(uploadCsv.error) : null)

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => {
          setIsDragging(false)
        }}
        onDrop={handleDrop}
        onClick={() => {
          inputRef.current?.click()
        }}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-slate-300 bg-white hover:bg-slate-50'
        }`}
      >
        <UploadCloud className="h-8 w-8 text-slate-400" aria-hidden="true" />
        <p className="text-sm text-slate-600">
          Drag &amp; drop a .csv file here, or{' '}
          <span className="font-medium text-emerald-700">browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.item(0)
            if (file !== null && file !== undefined) handleFile(file)
            event.target.value = ''
          }}
        />
      </div>
      {uploadCsv.isPending && <p className="mt-2 text-sm text-slate-500">Parsing…</p>}
      {errorToShow !== null && <p className="mt-2 text-sm text-rose-600">{errorToShow}</p>}
    </div>
  )
}
