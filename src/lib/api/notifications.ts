import type { NotificationRow } from '@/types'
import { toAppError } from '../errors'
import { callRpc } from './client'

export function listNotifications(limit = 50) {
  return callRpc<NotificationRow[]>('admin_list_notifications', { p_limit: limit })
}

export function getUnreadNotificationCount() {
  return callRpc<number>('admin_unread_notification_count')
}

export async function markNotificationRead(id: string) {
  try {
    return await callRpc<{ id: string; is_read: boolean }>('admin_mark_notification_read', {
      p_notification_id: id,
    })
  } catch (error) {
    throw toAppError(error)
  }
}

export async function markAllNotificationsRead() {
  try {
    return await callRpc<{ marked: number }>('admin_mark_all_notifications_read')
  } catch (error) {
    throw toAppError(error)
  }
}
