import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { ExpenseCreate, ExpenseListResponse, ExpenseResponse } from '../types/api'

export interface ExpenseFilters {
  dateFrom?: string
  dateTo?: string
  category?: string
  trip?: string
}

export interface ExpenseListParams extends ExpenseFilters {
  skip: number
  limit: number
}

export function useExpenses(params: ExpenseListParams) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: async () => {
      const { data } = await api.get<ExpenseListResponse>('/expenses/', {
        params: {
          date_from: params.dateFrom,
          date_to: params.dateTo,
          category: params.category,
          trip: params.trip,
          skip: params.skip,
          limit: params.limit,
        },
      })
      return data
    },
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expense: ExpenseCreate) => {
      const { data } = await api.post<ExpenseResponse>('/expenses/', expense)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

interface UpdateExpenseVariables {
  id: string
  expense: ExpenseCreate
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, expense }: UpdateExpenseVariables) => {
      const { data } = await api.put<ExpenseResponse>(`/expenses/${id}`, expense)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/expenses/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}
