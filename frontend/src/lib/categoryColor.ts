// Category has no `color` field on the backend (spec 02 §6 decision 2) --
// colors are derived deterministically from the name so the same category
// always renders the same color across sessions, without a schema change.
//
// Full class strings, not template-interpolated (e.g. NOT `bg-${x}-100`):
// Tailwind's build-time scanner only detects class names it can see
// literally in source, so a dynamically-built string would never generate
// the CSS and would silently render unstyled.
const PALETTE = [
  'bg-rose-100 text-rose-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-lime-100 text-lime-700',
  'bg-emerald-100 text-emerald-700',
  'bg-teal-100 text-teal-700',
  'bg-cyan-100 text-cyan-700',
  'bg-sky-100 text-sky-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-pink-100 text-pink-700',
]

export function categoryColorClasses(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % PALETTE.length
  return PALETTE[index]
}
