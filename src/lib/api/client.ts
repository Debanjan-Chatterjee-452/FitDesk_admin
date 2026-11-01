import type { QueryClient } from '@tanstack/react-query'
import { AppError, toAppError } from '../errors'
import { getSupabase } from '../supabase'

export async function callRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  try {
    const { data, error } = await getSupabase().rpc(name, args)
    if (error) throw error
    return data as T
  } catch (error) {
    throw toAppError(error)
  }
}

export function assertResult<T>(data: T, message: string): T {
  if (data == null) throw new AppError('EMPTY_RESULT', message)
  return data
}

export const queryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
}

export type { QueryClient }
