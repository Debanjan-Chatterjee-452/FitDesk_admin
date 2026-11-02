import type { AdminProfile, GymSettings } from '@/types'
import { AppError, toAppError } from '../errors'
import { getSupabase } from '../supabase'
import { callRpc } from './client'

export interface AdminSession {
  userId: string
  email: string
  profile: AdminProfile
  /** False while a brand-new owner still has to register their gym. */
  isAdmin: boolean
  gymId: string | null
  gymName: string | null
  gymPublicId: string | null
  gymJoinCode: string | null
  gymSuspended: boolean
  isPlatformOwner: boolean
}

async function loadProfile(userId: string): Promise<AdminProfile> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw toAppError(error)
  if (!data) throw new AppError('PROFILE_NOT_FOUND', 'The admin profile could not be loaded.')
  return data as AdminProfile
}

async function assertAdmin(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_admin')
  if (error) throw toAppError(error)
  return data === true
}

const EMPTY_GYM_CONTEXT: {
  gymId: string | null
  gymName: string | null
  gymPublicId: string | null
  gymJoinCode: string | null
  gymSuspended: boolean
} = {
  gymId: null,
  gymName: null,
  gymPublicId: null,
  gymJoinCode: null,
  gymSuspended: false,
}

async function loadGymContext(): Promise<typeof EMPTY_GYM_CONTEXT & { gymSuspended: boolean }> {
  try {
    const settings = await callRpc<GymSettings>('admin_get_gym_settings')
    return {
      gymId: settings.gym_id,
      gymName: settings.name,
      gymPublicId: settings.public_id,
      gymJoinCode: settings.join_code,
      gymSuspended: false,
    }
  } catch (error) {
    const appError = toAppError(error)
    if (appError.code === 'GYM_SUSPENDED') {
      return { ...EMPTY_GYM_CONTEXT, gymSuspended: true }
    }
    throw appError
  }
}

async function loadPlatformOwner(): Promise<boolean> {
  try {
    const result = await callRpc<{ is_platform_owner: boolean }>('platform_me')
    return result?.is_platform_owner === true
  } catch {
    return false
  }
}

export async function signInAdmin(email: string, password: string): Promise<AdminSession> {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) throw toAppError(error)
  if (!data.user) throw new AppError('AUTH_REQUIRED', 'Sign-in did not return a session.')

  const isAdmin = await assertAdmin()

  const gymContext = isAdmin ? await loadGymContext() : EMPTY_GYM_CONTEXT
  const isPlatformOwner = isAdmin ? await loadPlatformOwner() : false

  return {
    userId: data.user.id,
    email: data.user.email ?? email,
    profile: await loadProfile(data.user.id),
    isAdmin,
    ...gymContext,
    isPlatformOwner,
  }
}

/**
 * Restores an existing Supabase session. A signed-in account without the
 * admin role is returned with isAdmin=false so the app can send it to
 * /onboarding instead of silently signing it out.
 */
export async function restoreAdminSession(): Promise<AdminSession | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw toAppError(error)
  if (!data.session?.user) return null

  const isAdmin = await assertAdmin()

  const gymContext = isAdmin ? await loadGymContext() : EMPTY_GYM_CONTEXT
  const isPlatformOwner = isAdmin ? await loadPlatformOwner() : false

  return {
    userId: data.session.user.id,
    email: data.session.user.email ?? '',
    profile: await loadProfile(data.session.user.id),
    isAdmin,
    ...gymContext,
    isPlatformOwner,
  }
}

export async function signOutAdmin(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw toAppError(error)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabase()
  const redirectTo = `${window.location.origin}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  })
  if (error) throw toAppError(error)
}

export async function updatePassword(password: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw toAppError(error)
}

export async function refreshAdminProfile(userId: string): Promise<AdminProfile> {
  return loadProfile(userId)
}

export interface OwnerSignUpInput {
  fullName: string
  email: string
  phone: string
  gymName: string
  password: string
}

export interface OwnerSignUpResult {
  needsEmailConfirmation: boolean
  session: AdminSession | null
}

/**
 * Creates the auth account for a gym owner. The gym name and contact details
 * are stored in user metadata so the onboarding step survives email
 * confirmation, and so nothing is hardcoded per gym.
 */
export async function signUpOwner(input: OwnerSignUpInput): Promise<OwnerSignUpResult> {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        gym_name: input.gymName.trim(),
      },
    },
  })

  if (error) throw toAppError(error)

  if (!data.session) {
    return { needsEmailConfirmation: true, session: null }
  }

  return { needsEmailConfirmation: false, session: await restoreAdminSession() }
}

export interface PendingOwnerDetails {
  fullName: string
  phone: string
  gymName: string
}

/** Reads the details captured at sign-up, if the account has them. */
export async function readPendingOwnerDetails(): Promise<PendingOwnerDetails | null> {
  const { data, error } = await getSupabase().auth.getUser()
  if (error) return null
  const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : ''
  const phone = typeof meta.phone === 'string' ? meta.phone : ''
  const gymName = typeof meta.gym_name === 'string' ? meta.gym_name : ''
  if (!fullName && !phone && !gymName) return null
  return { fullName, phone, gymName }
}

export interface OnboardingInput {
  gymName: string
  fullName: string
  phone: string
}

/**
 * Creates the gym, makes the caller its admin and seeds the four payment
 * rails. Returns the freshly restored session so the router can move on.
 */
export async function completeOwnerOnboarding(input: OnboardingInput): Promise<AdminSession> {
  await callRpc<{
    gym_id: string
    slug: string
    name: string
    is_admin: boolean
  }>('register_gym_owner', {
    p_gym_name: input.gymName.trim(),
    p_full_name: input.fullName.trim(),
    p_phone: input.phone.trim() || null,
  })

  const session = await restoreAdminSession()
  if (!session) {
    throw new AppError('AUTH_REQUIRED', 'Your session expired. Sign in again to finish setup.')
  }
  return session
}

type PasswordCredentialConstructor = new (data: {
  id: string
  password: string
  name?: string
  iconURL?: string
}) => Credential

export type SavePasswordResult = 'saved' | 'unsupported' | 'failed'

/**
 * Explicit "Save password" action using the browser's Credential Management
 * API. Browsers that do not expose PasswordCredential still get the normal
 * native save prompt because the login form uses autocomplete="username" and
 * autocomplete="current-password".
 */
export async function saveBrowserPassword(
  email: string,
  password: string,
): Promise<SavePasswordResult> {
  const globalWindow = window as unknown as {
    PasswordCredential?: PasswordCredentialConstructor
  }
  const CredentialClass = globalWindow.PasswordCredential

  if (!CredentialClass || !navigator.credentials?.store) return 'unsupported'

  try {
    await navigator.credentials.store(
      new CredentialClass({
        id: email.trim().toLowerCase(),
        password,
        name: 'FitDesk Admin',
      }),
    )
    return 'saved'
  } catch {
    return 'failed'
  }
}
