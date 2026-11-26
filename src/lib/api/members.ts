import type { MemberRow, PaymentReviewResult, PendingPayment } from '@/types'
import { toAppError } from '../errors'
import { callRpc } from './client'

export function listMembers() {
  return callRpc<MemberRow[]>('admin_list_members', {
    p_search: null,
    p_status: null,
  })
}

export function listMembersPage(params: {
  search?: string | null
  status?: string | null
  limit?: number
  offset?: number
}) {
  return callRpc<MemberRow[]>('admin_list_members_page', {
    p_search: params.search?.trim() || null,
    p_status: params.status || null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  })
}

export function setMemberActive(userId: string, active: boolean) {
  return callRpc<{ user_id: string; active: boolean }>('admin_set_member_active', {
    p_user_id: userId,
    p_active: active,
  })
}

export async function adjustMembershipDates(membershipId: string, startsOn: string) {
  return callRpc<{ membership_id: string; starts_on: string; ends_on: string; duration_days: number }>(
    'admin_adjust_membership_dates',
    { p_membership_id: membershipId, p_starts_on: startsOn },
  )
}

export function generateExpiryNotifications() {
  return callRpc<number>('admin_generate_expiry_notifications')
}

export function getMemberStatusCounts() {
  return callRpc<{ all: number; pending: number; paid: number; not_paid: number; left: number }>(
    'admin_member_status_counts',
  )
}

export async function updateMemberMembership(input: {
  userId: string
  startsOn: string
  endsOn: string
  isPaid: boolean
}) {
  try {
    return await callRpc<{
      user_id: string
      membership_id: string | null
      starts_on: string
      ends_on: string
      is_paid: boolean
    }>('admin_update_member_membership', {
      p_user_id: input.userId,
      p_starts_on: input.startsOn,
      p_ends_on: input.endsOn,
      p_is_paid: input.isPaid,
    })
  } catch (error) {
    throw toAppError(error)
  }
}

export async function cancelMembership(membershipId: string, reason: string) {
  try {
    return await callRpc<{ membership_id: string; status: string; cancelled_at: string }>(
      'admin_cancel_membership',
      { p_membership_id: membershipId, p_reason: reason },
    )
  } catch (error) {
    throw toAppError(error)
  }
}

export async function pauseMembership(membershipId: string, reason: string) {
  try {
    return await callRpc<{ membership_id: string; status: string; paused_at: string; paused_from: string }>(
      'admin_pause_membership',
      { p_membership_id: membershipId, p_reason: reason },
    )
  } catch (error) {
    throw toAppError(error)
  }
}

export async function resumeMembership(membershipId: string) {
  try {
    return await callRpc<{ membership_id: string; status: string; paused_days: number; new_ends_on: string }>(
      'admin_resume_membership',
      { p_membership_id: membershipId },
    )
  } catch (error) {
    throw toAppError(error)
  }
}

export function listPendingPayments() {
  return callRpc<PendingPayment[]>('admin_list_pending_payments')
}

export async function generateCashOtp(paymentId: string) {
  try {
    return await callRpc<{ otp_code: string; expires_at: string; payment_id: string }>(
      'admin_generate_cash_otp',
      { p_payment_id: paymentId },
    )
  } catch (error) {
    throw toAppError(error)
  }
}

export async function reviewPayment(
  paymentId: string,
  decision: 'approved' | 'declined',
  note?: string | null,
): Promise<PaymentReviewResult> {
  try {
    return await callRpc<PaymentReviewResult>('admin_review_payment', {
      p_payment_id: paymentId,
      p_decision: decision,
      p_note: note?.trim() || null,
    })
  } catch (error) {
    throw toAppError(error)
  }
}
