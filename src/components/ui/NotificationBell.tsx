import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { adminKeys } from '@/lib/queryKeys'
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications'
import { cn } from '@/lib/format'
import { formatDateTime } from '@/lib/format'

export function NotificationBell() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const countQuery = useQuery({
    queryKey: adminKeys.notificationsCount(),
    queryFn: getUnreadNotificationCount,
    refetchInterval: 30_000,
  })

  const listQuery = useQuery({
    queryKey: adminKeys.notifications(),
    queryFn: () => listNotifications(30),
    enabled: open,
  })

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.notifications() })
      void queryClient.invalidateQueries({ queryKey: adminKeys.notificationsCount() })
    },
  })

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.notifications() })
      void queryClient.invalidateQueries({ queryKey: adminKeys.notificationsCount() })
    },
  })

  const count = countQuery.data ?? 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink shadow-sm"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-12 z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Notifications</p>
              {count > 0 ? (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  <CheckCheck className="mr-1 inline h-3.5 w-3.5" />
                  Mark all read
                </button>
              ) : null}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {listQuery.isLoading ? (
                <p className="px-4 py-6 text-center text-xs text-muted">Loading…</p>
              ) : (listQuery.data ?? []).length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted">No notifications yet.</p>
              ) : (
                (listQuery.data ?? []).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.is_read) markRead.mutate(n.id)
                    }}
                    className={cn(
                      'block w-full border-b border-line px-4 py-3 text-left transition hover:bg-elevated',
                      !n.is_read && 'bg-primary-soft/40',
                    )}
                  >
                    <p className="text-xs font-semibold text-ink">{n.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted">{n.body}</p>
                    <p className="mt-1.5 text-[10px] text-faint">{formatDateTime(n.created_at)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
