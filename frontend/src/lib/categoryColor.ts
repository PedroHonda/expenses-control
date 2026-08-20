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

// Same hue order as PALETTE above, as hex -- Tailwind's -500 shades. Charts
// (Recharts <Bar fill>/<Cell fill>) take a real CSS color, not a class name,
// so this is a parallel lookup rather than a derivation from PALETTE.
const CHART_PALETTE = [
  '#f43f5e', // rose-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#84cc16', // lime-500
  '#10b981', // emerald-500
  '#14b8a6', // teal-500
  '#06b6d4', // cyan-500
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#d946ef', // fuchsia-500
  '#ec4899', // pink-500
]

function categoryHashIndex(name: string, paletteLength: number): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % paletteLength
}

export function categoryColorClasses(name: string): string {
  return PALETTE[categoryHashIndex(name, PALETTE.length)]
}

export function categoryChartColor(name: string): string {
  return CHART_PALETTE[categoryHashIndex(name, CHART_PALETTE.length)]
}
