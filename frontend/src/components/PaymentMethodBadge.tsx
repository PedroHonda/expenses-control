// Reuses the category color helpers as-is: they're plain name-hash
// functions, not actually category-specific despite the name (see
// lib/categoryColor.ts) -- a second, parallel color module isn't needed
// just because the caller is a payment method instead of a category.
import { categoryColorClasses } from '../lib/categoryColor'

interface PaymentMethodBadgeProps {
  name: string
}

export function PaymentMethodBadge({ name }: PaymentMethodBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColorClasses(name)}`}
    >
      {name}
    </span>
  )
}
