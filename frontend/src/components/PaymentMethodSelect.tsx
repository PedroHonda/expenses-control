import { useState } from 'react'
import type { ChangeEvent, SubmitEvent } from 'react'
import { usePaymentMethods, useCreatePaymentMethod } from '../hooks/usePaymentMethods'
import { getErrorMessage } from '../lib/errors'

interface PaymentMethodSelectProps {
  value: string
  onChange: (value: string) => void
  id?: string
  required?: boolean
}

const CREATE_NEW_VALUE = '__create_new__'

/** Mirrors CategorySelect exactly (dropdown + inline "create new") -- see
 * that component for the pattern this follows. */
export function PaymentMethodSelect({
  value,
  onChange,
  id,
  required = false,
}: PaymentMethodSelectProps) {
  const { data: paymentMethods, isPending, isError } = usePaymentMethods()
  const createPaymentMethod = useCreatePaymentMethod()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  function handleSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    const selected = event.target.value
    if (selected === CREATE_NEW_VALUE) {
      setCreating(true)
      return
    }
    onChange(selected)
  }

  function handleCreateSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)
    createPaymentMethod.mutate(newName.trim(), {
      onSuccess: (paymentMethod) => {
        onChange(paymentMethod.name)
        setCreating(false)
        setNewName('')
      },
      onError: (error: unknown) => {
        setCreateError(getErrorMessage(error))
      },
    })
  }

  if (creating) {
    return (
      <form onSubmit={handleCreateSubmit} className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          type="text"
          value={newName}
          onChange={(event) => {
            setNewName(event.target.value)
          }}
          placeholder="New payment method name"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          maxLength={50}
          required
        />
        <button
          type="submit"
          disabled={createPaymentMethod.isPending}
          className="text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setCreating(false)
            setCreateError(null)
          }}
          className="text-sm text-slate-500 hover:underline"
        >
          Cancel
        </button>
        {createError !== null && <span className="text-xs text-rose-600">{createError}</span>}
      </form>
    )
  }

  return (
    <select
      id={id}
      value={value}
      onChange={handleSelectChange}
      required={required}
      disabled={isPending}
      className="rounded border border-slate-300 px-2 py-1 text-sm"
    >
      {value === '' && (
        <option value="" disabled>
          Select a payment method
        </option>
      )}
      {isError && (
        <option value="" disabled>
          Failed to load payment methods
        </option>
      )}
      {paymentMethods?.map((paymentMethod) => (
        <option key={paymentMethod.id} value={paymentMethod.name}>
          {paymentMethod.name}
        </option>
      ))}
      <option value={CREATE_NEW_VALUE}>+ Create new payment method…</option>
    </select>
  )
}
