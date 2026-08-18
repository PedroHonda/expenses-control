import { categoryColorClasses } from '../lib/categoryColor'

interface CategoryBadgeProps {
  name: string
}

export function CategoryBadge({ name }: CategoryBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColorClasses(name)}`}
    >
      {name}
    </span>
  )
}
