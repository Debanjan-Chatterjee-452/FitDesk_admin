import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { adminKeys } from './queryKeys'
import { useAuth } from '@/context/AuthContext'

/**
 * Admin-side Supabase Realtime bridge.
 *
 * Subscribes to the tables that change as members act (join requests, payments,
 * memberships, profile updates, announcements) and invalidates the affected
 * React Query caches. All filters are scoped to the admin's gym_id so one
 * gym never receives another gym's events.
 */
export function useAdminRealtime() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>['channel']> | null>(null)
  const gymId = session?.gymId ?? null

  useEffect(() => {
    if (!gymId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`fitdesk-admin:${gymId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gym_join_requests', filter: `gym_id=eq.${gymId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'join-requests'] })
          void queryClient.invalidateQueries({ queryKey: adminKeys.members() })
          void queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `gym_id=eq.${gymId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.pendingPayments() })
          void queryClient.invalidateQueries({ queryKey: adminKeys.members() })
          void queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memberships', filter: `gym_id=eq.${gymId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.members() })
          void queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `gym_id=eq.${gymId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.members() })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements', filter: `gym_id=eq.${gymId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: adminKeys.closures('', '') })
          void queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
        },
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [gymId, queryClient])

  return channelRef.current
}
