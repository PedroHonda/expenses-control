import { useCategories } from '../hooks/useCategories'
import { CategoryBadge } from './CategoryBadge'

interface CategoryMultiSelectProps {
  selected: Set<string>
  onChange: (selected: Set<string>) => void
}

export function CategoryMultiSelect({ selected, onChange }: CategoryMultiSelectProps) {
  const { data: categories, isPending, isError } = useCategories()

  function toggle(name: string) {
    const next = new Set(selected)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    onChange(next)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Categories</h3>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => {
              onChange(new Set(categories?.map((category) => category.name)))
            }}
            className="text-emerald-700 hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(new Set())
            }}
            className="text-slate-500 hover:underline"
          >
            Deselect all
          </button>
        </div>
      </div>

      {isPending && <p className="text-sm text-slate-500">Loading categories…</p>}
      {isError && <p className="text-sm text-rose-600">Failed to load categories.</p>}

      {categories && (
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {categories.map((category) => (
            <li key={category.id}>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(category.name)}
                  onChange={() => {
                    toggle(category.name)
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <CategoryBadge name={category.name} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
