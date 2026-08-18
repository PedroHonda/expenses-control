import { vi } from 'vitest'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'

/**
 * Component tests in this project mock hooks at the module boundary
 * (`vi.mock('../hooks/useCategories')`) rather than rendering a real
 * QueryClientProvider + network layer -- these factories build just-enough
 * fake React Query result objects for that. The `as unknown as X` cast is
 * deliberate and confined to this one file: a test double only needs to
 * satisfy what the component under test actually reads off the object, not
 * React Query's full internal shape.
 */

export function mockQueryResult<T>(overrides: Record<string, unknown> = {}): UseQueryResult<T> {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as unknown as UseQueryResult<T>
}

// TError defaults to Error, matching what `useMutation({...})` itself
// defaults to when the hook definitions don't specify a custom error type
// (see src/hooks/*.ts) -- mismatching this default is exactly what made
// `tsc -b` (but not `vitest run`, which doesn't fully type-check) reject
// these mocks against the real hooks' inferred return types.
export function mockMutationResult<TData = unknown, TVariables = unknown, TError = Error>(
  overrides: Record<string, unknown> = {},
): UseMutationResult<TData, TError, TVariables> {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
    ...overrides,
  } as unknown as UseMutationResult<TData, TError, TVariables>
}
