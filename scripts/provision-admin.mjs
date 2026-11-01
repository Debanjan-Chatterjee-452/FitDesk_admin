#!/usr/bin/env node
/**
 * Provision (or repair) the FitDesk admin account.
 *
 * The admin password is assigned by the developer and lives only in Supabase
 * Auth. This script uses a service-role/secret key to:
 *   1. create the auth user when it does not exist,
 *   2. reset its password (so the preset password is authoritative),
 *   3. mark its profile row as `is_admin = true`,
 *   4. bind that profile to the gym.
 *
 * Required environment variables (never commit them):
 *   SUPABASE_URL=https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role or sb_secret_... key>
 *   ADMIN_EMAIL=<preset admin email>
 *   ADMIN_PASSWORD=<preset admin password>
 *
 * Optional:
 *   ADMIN_NAME="Gym Owner"
 *   GYM_SLUG=fitdesk
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL="https://xxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *   $env:ADMIN_EMAIL="owner@example.com"
 *   $env:ADMIN_PASSWORD="..."
 *   npm.cmd run provision:admin
 */

const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '')
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD ?? ''
const fullName = (process.env.ADMIN_NAME ?? '').trim()
const gymSlug = (process.env.GYM_SLUG ?? 'fitdesk').trim().toLowerCase()

function fail(message) {
  console.error(`\n[provision-admin] ${message}\n`)
  process.exit(1)
}

if (!url) fail('SUPABASE_URL is missing.')
if (!/^https:\/\/.+\.supabase\.co$/.test(url)) {
  fail('SUPABASE_URL must look like https://<project-ref>.supabase.co')
}
if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY is missing.')
if (serviceKey.startsWith('sb_publishable_')) {
  fail('That looks like a publishable key. Use the service-role or sb_secret_ key.')
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('ADMIN_EMAIL is not a valid email.')
if (password.length < 8) fail('ADMIN_PASSWORD must be at least 8 characters.')

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  if (!response.ok) {
    const detail =
      typeof body === 'string'
        ? body
        : body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? text
    throw new Error(`${options.method ?? 'GET'} ${path} failed (${response.status}): ${detail}`)
  }
  return body
}

async function findUserByEmail() {
  const perPage = 200
  for (let page = 1; page <= 50; page += 1) {
    const users = await request(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`)
    const list = Array.isArray(users) ? users : (users?.users ?? [])
    const match = list.find((user) => String(user.email ?? '').toLowerCase() === email)
    if (match) return match
    if (list.length < perPage) return null
  }
  throw new Error('More than 10,000 auth users; cannot scan for the admin email.')
}

async function upsertAuthUser() {
  const existing = await findUserByEmail()
  if (existing) {
    const updated = await request(`/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        password,
        email_confirm: true,
        ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
      }),
    })
    return { user: updated, created: false }
  }

  const created = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
    }),
  })
  return { user: created, created: true }
}

async function resolveGym() {
  const gyms = await request(
    `/rest/v1/gyms?slug=eq.${encodeURIComponent(gymSlug)}&select=id,name&limit=1`,
  )
  const gym = Array.isArray(gyms) ? gyms[0] : null
  if (!gym) {
    throw new Error(
      `No gym with slug "${gymSlug}". Run the Supabase migrations in supabase/migrations first.`,
    )
  }
  return gym
}

async function upsertAdminProfile(userId, gymId) {
  const patch = {
    is_admin: true,
    gym_id: gymId,
    ...(fullName ? { full_name: fullName } : {}),
  }

  const updated = await request(`/rest/v1/profiles?id=eq.${userId}&select=id,is_admin,gym_id`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })

  if (Array.isArray(updated) && updated.length > 0) return updated[0]

  // The auth trigger normally creates the row. Insert defensively for accounts
  // that predate the trigger.
  const inserted = await request('/rest/v1/profiles?select=id,is_admin,gym_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ id: userId, phone: '', ...patch }),
  })
  if (Array.isArray(inserted) && inserted.length > 0) return inserted[0]
  throw new Error('The admin profile row could not be created.')
}

async function main() {
  console.log(`[provision-admin] project ${url}`)
  console.log(`[provision-admin] admin   ${email}`)

  const gym = await resolveGym()
  console.log(`[provision-admin] gym     ${gym.name} (${gym.id})`)

  const { user, created } = await upsertAuthUser()
  console.log(`[provision-admin] auth    ${created ? 'created' : 'updated'} ${user.id}`)

  const profile = await upsertAdminProfile(user.id, gym.id)
  console.log(`[provision-admin] profile is_admin=${profile.is_admin} gym_id=${profile.gym_id}`)
  console.log('\n[provision-admin] Done. Sign in with the preset email and password.')
}

main().catch((error) => fail(error.message))
