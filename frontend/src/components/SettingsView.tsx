import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useCategories, useCreateCategory, useUpdateCategory } from '../hooks/useCategories'
import {
  useCreatePaymentMethod,
  usePaymentMethods,
  useSetDefaultImportPaymentMethod,
} from '../hooks/usePaymentMethods'
import { CategoryBadge } from './CategoryBadge'
import { PaymentMethodBadge } from './PaymentMethodBadge'
import { getErrorMessage } from '../lib/errors'

export function SettingsView() {
  const { data: categories, isPending, isError } = useCategories()
  const updateCategory = useUpdateCategory()
  const createCategory = useCreateCategory()
  const [newCategoryName, setNewCategoryName] = useState('')
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null)

  function handleCreateCategory(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateCategoryError(null)
    createCategory.mutate(newCategoryName.trim(), {
      onSuccess: () => {
        setNewCategoryName('')
      },
      onError: (error: unknown) => {
        setCreateCategoryError(getErrorMessage(error))
      },
    })
  }

  const {
    data: paymentMethods,
    isPending: isPaymentMethodsPending,
    isError: isPaymentMethodsError,
  } = usePaymentMethods()
  const setDefaultImportPaymentMethod = useSetDefaultImportPaymentMethod()
  const createPaymentMethod = useCreatePaymentMethod()
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  function handleCreatePaymentMethod(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)
    createPaymentMethod.mutate(newPaymentMethodName.trim(), {
      onSuccess: () => {
        setNewPaymentMethodName('')
      },
      onError: (error: unknown) => {
        setCreateError(getErrorMessage(error))
      },
    })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Categories</h2>
          <p className="text-sm text-slate-500">
            Categories checked here are excluded from the dashboard&apos;s Total (e.g. bill payments
            or refunds aren&apos;t real spending). They still appear in the expense list and in
            filters.
          </p>
        </div>

        {isPending && <p className="text-sm text-slate-500">Loading categories…</p>}
        {isError && <p className="text-sm text-rose-600">Failed to load categories.</p>}

        {categories && (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between px-4 py-2.5">
                <CategoryBadge name={category.name} />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  Exclude from Total
                  <input
                    type="checkbox"
                    checked={category.exclude_from_total}
                    disabled={updateCategory.isPending}
                    onChange={(event) => {
                      updateCategory.mutate({
                        id: category.id,
                        exclude_from_total: event.target.checked,
                      })
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreateCategory} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(event) => {
              setNewCategoryName(event.target.value)
            }}
            placeholder="New category name"
            maxLength={50}
            required
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={createCategory.isPending}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Add Category
          </button>
          {createCategoryError !== null && (
            <span className="text-xs text-rose-600">{createCategoryError}</span>
          )}
        </form>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Payment Methods</h2>
          <p className="text-sm text-slate-500">
            The method marked &quot;CSV import default&quot; is what new CSV imports and new manual
            expenses start pre-filled with -- pick a different one below to change it, or register a
            new payment method entirely.
          </p>
        </div>

        {isPaymentMethodsPending && (
          <p className="text-sm text-slate-500">Loading payment methods…</p>
        )}
        {isPaymentMethodsError && (
          <p className="text-sm text-rose-600">Failed to load payment methods.</p>
        )}

        {paymentMethods && (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {paymentMethods.map((paymentMethod) => (
              <li key={paymentMethod.id} className="flex items-center justify-between px-4 py-2.5">
                <PaymentMethodBadge name={paymentMethod.name} />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  CSV import default
                  <input
                    type="radio"
                    name="default-import-payment-method"
                    checked={paymentMethod.is_default_for_import}
                    disabled={setDefaultImportPaymentMethod.isPending}
                    onChange={() => {
                      setDefaultImportPaymentMethod.mutate(paymentMethod.id)
                    }}
                    className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreatePaymentMethod} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newPaymentMethodName}
            onChange={(event) => {
              setNewPaymentMethodName(event.target.value)
            }}
            placeholder="New payment method name"
            maxLength={50}
            required
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={createPaymentMethod.isPending}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Add Payment Method
          </button>
          {createError !== null && <span className="text-xs text-rose-600">{createError}</span>}
        </form>
      </div>
    </div>
  )
}
