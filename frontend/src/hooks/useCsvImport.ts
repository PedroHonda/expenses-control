import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { CSVParseResponse, ExpenseCreate, ImportBatchResponse } from '../types/api'

/** Stage 1: parse-only, no persistence. See spec 01 §4.2. */
export function useUploadCsv() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<CSVParseResponse>('/expenses/upload-csv', formData)
      return data
    },
  })
}

/** Stage 2: validate + persist the batch the user completed in the review
 * table. All-or-nothing on the backend -- see spec 01 §4.3. */
export function useImportBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expenses: ExpenseCreate[]) => {
      const { data } = await api.post<ImportBatchResponse>('/expenses/import-batch', {
        expenses,
      })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}
