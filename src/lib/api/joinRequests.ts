import { callRpc } from './client'

export interface JoinRequestRow {
  id: string
  status: string
  requested_at: string
  user_email: string
  member_user_id: string | null
  member_name: string | null
  member_phone: string | null
  member_date_of_birth: string | null
  member_gender: string | null
  member_blood_group: string | null
  member_avatar_path: string | null
  member_profile_completed: boolean
  member_document_path: string | null
  member_document_name: string | null
  member_document_mime_type: string | null
  member_document_type: string | null
  member_document_number: string | null
}

export function listJoinRequests() {
  return callRpc<JoinRequestRow[]>('admin_list_join_requests')
}

export function pendingJoinRequestCount() {
  return callRpc<number>('admin_pending_join_request_count')
}

export async function reviewJoinRequest(requestId: string, approve: boolean) {
  return callRpc<{ status: string; gym_id: string }>('admin_review_join_request', {
    p_request_id: requestId,
    p_approve: approve,
  })
}
