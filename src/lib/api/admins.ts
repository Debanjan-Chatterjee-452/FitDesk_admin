import { callRpc } from './client'

export function addGymAdmin(email: string) {
  return callRpc<{ status: string; user_id: string }>('admin_add_gym_admin', { p_email: email })
}

export function removeGymAdmin(userId: string) {
  return callRpc<{ status: string; user_id: string }>('admin_remove_gym_admin', { p_user_id: userId })
}
