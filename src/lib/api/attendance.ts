import type { AttendanceQrState } from '@/types'
import { callRpc } from './client'

export function getAttendanceQr() {
  return callRpc<AttendanceQrState>('admin_get_attendance_qr')
}

export function rotateAttendanceQr(label?: string) {
  return callRpc<AttendanceQrState>('admin_rotate_attendance_qr', {
    p_label: label?.trim() || 'Front desk',
  })
}

export function setAttendanceRotation(months: number) {
  return callRpc<AttendanceQrState>('admin_set_attendance_rotation', {
    p_months: months,
  })
}
