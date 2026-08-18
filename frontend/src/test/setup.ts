import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmounts anything rendered by the previous test -- without this, DOM
// nodes (and any event listeners/timers a component set up) leak across
// tests, since Vitest doesn't reset the jsdom document between test files
// the way Jest's default config sometimes implies.
afterEach(() => {
  cleanup()
})
