import type { ClosureRow, DashboardStats, GymSettings } from '@/types'
import { callRpc } from './client'

export function getDashboardStats() {
  return callRpc<DashboardStats>('admin_dashboard_stats')
}

export function getGymSettings() {
  return callRpc<GymSettings>('admin_get_gym_settings')
}

export function setGymOpen(open: boolean) {
  return callRpc<{ is_open: boolean; shutter_changed_at: string }>('admin_set_gym_open', {
    p_open: open,
  })
}

export function listClosures(from: string, to: string) {
  return callRpc<ClosureRow[]>('admin_list_closures', { p_from: from, p_to: to })
}

export function setClosure(date: string, closed: boolean, reason?: string | null) {
  return callRpc<{ date: string; is_closed: boolean; reason: string | null }>(
    'admin_set_closure',
    {
      p_date: date,
      p_closed: closed,
      p_reason: reason?.trim() || null,
    },
  )
}
