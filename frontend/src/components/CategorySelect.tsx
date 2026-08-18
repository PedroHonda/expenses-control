import { useState } from 'react'
import type { ChangeEvent, SubmitEvent } from 'react'
import { useCategories, useCreateCategory } from '../hooks/useCategories'
import { getErrorMessage } from '../lib/errors'

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  id?: string
  required?: boolean
  /** FilterBar wants an "all categories" option; forms don't. */
  allowEmpty?: boolean
  emptyLabel?: string
}

const CREATE_NEW_VALUE = '__create_new__'

export function CategorySelect({
  value,
  onChange,
  id,
  required = false,
  allowEmpty = false,
  emptyLabel = 'All categories',
}: CategorySelectProps) {
  const { data: categories, isPending, isError } = useCategories()
  const createCategory = useCreateCategory()
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
    createCategory.mutate(newName.trim(), {
      onSuccess: (category) => {
        onChange(category.name)
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
          placeholder="New category name"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          maxLength={50}
          required
        />
        <button
          type="submit"
          disabled={createCategory.isPending}
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
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {!allowEmpty && value === '' && (
        <option value="" disabled>
          Select a category
        </option>
      )}
      {isError && (
        <option value="" disabled>
          Failed to load categories
        </option>
      )}
      {categories?.map((category) => (
        <option key={category.id} value={category.name}>
          {category.name}
        </option>
      ))}
      <option value={CREATE_NEW_VALUE}>+ Create new category…</option>
    </select>
  )
}
