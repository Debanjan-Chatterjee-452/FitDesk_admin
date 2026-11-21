import { callRpc } from './client'

export interface GymAdminRow {
  user_id: string
  email: string | null
  full_name: string | null
  phone: string
  avatar_path: string | null
  is_owner: boolean
  is_self: boolean
  created_at: string
}

export function listGymAdmins() {
  return callRpc<GymAdminRow[]>('admin_list_gym_admins')
}

export function createGymAdmin(input: {
  fullName: string
  email: string
  password: string
  phone?: string
}) {
  return callRpc<{ status: string; user_id: string; existing_user: boolean }>(
    'admin_create_gym_admin',
    {
      p_full_name: input.fullName.trim(),
      p_email: input.email.trim(),
      p_password: input.password,
      p_phone: input.phone?.trim() || null,
    },
  )
}

export function updateGymAdmin(input: {
  userId: string
  fullName: string
  phone?: string
  password?: string
}) {
  return callRpc<{ status: string; user_id: string }>('admin_update_gym_admin', {
    p_user_id: input.userId,
    p_full_name: input.fullName.trim(),
    p_phone: input.phone?.trim() || null,
    p_password: input.password?.trim() ? input.password : null,
  })
}

export function removeGymAdmin(userId: string) {
  return callRpc<{ status: string; user_id: string }>('admin_remove_gym_admin', {
    p_user_id: userId,
  })
}

/** Legacy email-only promote path, retained for existing callers. */
export function addGymAdmin(email: string) {
  return callRpc<{ status: string; user_id: string }>('admin_add_gym_admin', {
    p_email: email,
  })
}
