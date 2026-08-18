import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryBadge } from './CategoryBadge'

describe('CategoryBadge', () => {
  it('renders the category name', () => {
    render(<CategoryBadge name="Uber" />)
    expect(screen.getByText('Uber')).toBeInTheDocument()
  })

  it('renders the same color classes for the same name every time', () => {
    const { container: first } = render(<CategoryBadge name="Food" />)
    const { container: second } = render(<CategoryBadge name="Food" />)
    expect(first.querySelector('span')?.className).toBe(second.querySelector('span')?.className)
  })
})
