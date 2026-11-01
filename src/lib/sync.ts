import type { QueryClient } from '@tanstack/react-query'
import { adminKeys } from './queryKeys'

/**
 * Realtime integration seam.
 *
 * The admin UI never talks to a socket yet. Every mutation and every future
 * server push is expressed as one of these domain events. When the member app
 * and admin site are synced later, a Supabase Realtime channel (or any socket
 * transport) only needs to call emitAdminSync(domain); this bridge invalidates
 * precisely the affected React Query caches.
 */
export type AdminSyncDomain =
  | 'gym'
  | 'stats'
  | 'packages'
  | 'members'
  | 'payments'
  | 'closures'
  | 'attendance'
  | 'profile'

export interface AdminSyncEvent {
  domain: AdminSyncDomain
  at: string
}

const SYNC_EVENT = 'fitdesk:admin-sync'

export function emitAdminSync(domain: AdminSyncDomain): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<AdminSyncEvent>(SYNC_EVENT, {
      detail: { domain, at: new Date().toISOString() },
    }),
  )
}

export function subscribeToAdminSync(
  handler: (event: AdminSyncEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (event: Event) => {
    const custom = event as CustomEvent<AdminSyncEvent>
    if (custom.detail?.domain) handler(custom.detail)
  }
  window.addEventListener(SYNC_EVENT, listener)
  return () => window.removeEventListener(SYNC_EVENT, listener)
}

function keysFor(domain: AdminSyncDomain) {
  switch (domain) {
    case 'gym':
      return [adminKeys.gym(), adminKeys.stats()]
    case 'packages':
      return [adminKeys.packages(), adminKeys.stats()]
    case 'members':
      return [adminKeys.members(), adminKeys.stats()]
    case 'payments':
      return [
        adminKeys.pendingPayments(),
        adminKeys.members(),
        adminKeys.stats(),
      ]
    case 'closures':
      return [adminKeys.closures('', '').slice(0, 2)]
    case 'attendance':
      return [adminKeys.attendance(), adminKeys.stats()]
    case 'profile':
      return [adminKeys.profile()]
    case 'stats':
      return [adminKeys.stats()]
  }
}

export function invalidateAdminDomain(
  queryClient: QueryClient,
  domain: AdminSyncDomain,
): void {
  for (const key of keysFor(domain)) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}

/** Installed once by the QueryClient provider. */
export function installAdminSyncBridge(queryClient: QueryClient): () => void {
  return subscribeToAdminSync((event) => invalidateAdminDomain(queryClient, event.domain))
}
