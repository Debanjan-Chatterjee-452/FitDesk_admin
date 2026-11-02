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

export function getMemberStatusCounts() {
  return callRpc<{ all: number; pending: number; paid: number; not_paid: number }>(
    'admin_member_status_counts',
  )
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
