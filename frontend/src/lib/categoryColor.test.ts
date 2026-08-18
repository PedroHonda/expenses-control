import { describe, expect, it } from 'vitest'
import { categoryColorClasses } from './categoryColor'

describe('categoryColorClasses', () => {
  it('is deterministic for the same name', () => {
    expect(categoryColorClasses('Uber')).toBe(categoryColorClasses('Uber'))
  })

  it('returns a complete, literal Tailwind class pair', () => {
    // Must be a full literal string, not built via interpolation --
    // Tailwind's static scanner can't see a dynamically-constructed
    // class name like `bg-${x}-100` and would never generate its CSS.
    expect(categoryColorClasses('Food')).toMatch(/^bg-\w+-100 text-\w+-700$/)
  })

  it('varies across different category names', () => {
    const names = ['Uber', 'Food', 'Health', 'Care', 'Home', 'Car', 'Toll', 'Show']
    const colors = new Set(names.map(categoryColorClasses))
    expect(colors.size).toBeGreaterThan(1)
  })
})
