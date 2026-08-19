import { useCategories, useUpdateCategory } from '../hooks/useCategories'
import { CategoryBadge } from './CategoryBadge'

export function SettingsView() {
  const { data: categories, isPending, isError } = useCategories()
  const updateCategory = useUpdateCategory()

  return (
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
    </div>
  )
}
