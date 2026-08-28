import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { PaymentMethod } from '../types/api'

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data } = await api.get<PaymentMethod[]>('/payment-methods/')
      return data
    },
  })
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<PaymentMethod>('/payment-methods/', { name })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
    },
  })
}

/** Sets `id` as the CSV-import default -- the backend keeps this exclusive
 * (every other payment method's flag is cleared server-side), so the only
 * variable the caller supplies is which id becomes the new default. */
export function useSetDefaultImportPaymentMethod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<PaymentMethod>(`/payment-methods/${id}`, {
        is_default_for_import: true,
      })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
    },
  })
}
