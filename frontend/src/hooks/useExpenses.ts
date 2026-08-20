import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type {
  ExpenseCreate,
  ExpenseListResponse,
  ExpenseResponse,
  ExpenseSummaryResponse,
} from '../types/api'

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

export interface ExpenseSummaryParams {
  dateFrom?: string
  dateTo?: string
}

/** Unpaginated per-category totals for a date range -- backs the Reports
 * view (spec 06). Unlike `useExpenses`, there's no `limit`/`skip`: the
 * backend aggregates the whole range server-side, so the Reports view can
 * toggle category selection client-side without refetching. */
export function useExpenseSummary(params: ExpenseSummaryParams) {
  return useQuery({
    queryKey: ['expense-summary', params],
    queryFn: async () => {
      const { data } = await api.get<ExpenseSummaryResponse>('/expenses/summary', {
        params: {
          date_from: params.dateFrom,
          date_to: params.dateTo,
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
