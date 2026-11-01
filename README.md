# FitDesk Admin

The gym owner's control room for **FitDesk Performance Club**. It manages members,
manual UPI payment approvals, membership packages, the single gym-wide attendance
QR, the gym open/closed shutter, and the closure calendar.

The app is a standalone React SPA backed by Supabase. It is intentionally built so
a future realtime/socket bridge to the FitDesk member app can be added without
rewriting pages.

---

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS 3
- TanStack Query 5 for server state
- React Router 7
- React Hook Form + Zod
- Supabase Auth, Postgres, Storage
- `qrcode` for client-side attendance QR rendering

Requires Node `^20.19` or `>=22.12` and npm 10+.

---

## Quick start

```powershell
cd "D:\Gym Admin Website"
npm.cmd install
npm.cmd run dev
```

Open the printed URL (default `http://localhost:5173`).

Useful scripts:

| Script | Purpose |
| --- | --- |
| `npm.cmd run dev` | Vite dev server |
| `npm.cmd run build` | Type-check and production build |
| `npm.cmd run lint` | oxlint |
| `npm.cmd run test` | Vitest unit tests |
| `npm.cmd run preview` | Preview the production build |
| `npm.cmd run provision:admin` | Create/reset the admin account (see below) |

PowerShell may block `npm.ps1`; use `npm.cmd` on Windows.

---

## Environment

Copy `.env.example` to `.env.local` and fill in:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable or legacy anon key>
VITE_ADMIN_EMAIL=<preset admin email>
```

- `VITE_*` values are inlined into the browser bundle. **Never** put a
  service-role key, secret key, database password, or admin password in them.
- The admin password is assigned by the developer in Supabase Auth and is never
  stored in this repository or in frontend environment variables.
- `VITE_ADMIN_EMAIL` only prefills the login form. It is not a secret.

The checked-in project currently points at the existing FitDesk Supabase project.

---

## Supabase setup

### 1. Apply migrations

Apply every file in `supabase/migrations` **in filename order** to a new Supabase
project:

```
20261027000100_fitdesk_core.sql
20261027000200_fitdesk_functions.sql
20261027000300_fitdesk_rls_storage_seed.sql
20261027000400_fitdesk_manual_payment_approval.sql
20261028000100_fitdesk_preserve_active_membership.sql
20261028000200_fitdesk_payment_safety.sql
20261029000100_fitdesk_upi_payments.sql
20261030000100_fitdesk_late_fee_five_per_day.sql
20261031000100_fitdesk_admin_portal.sql
```

With the Supabase CLI:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Or paste each file into the Supabase SQL editor in order. The first eight files
are the shared FitDesk schema copied from the member app, so this repository is
self-contained. The last file adds the admin portal RPC surface and admin-only
storage policies.

The migrations create:

- `profiles`, `packages`, `memberships`, `attendance`, `payments`,
  `announcements`, `gym_settings`, `gym_qr_codes`
- `gyms` (multi-gym payment settings and shutter state)
- private `legal-documents` and `gym-payment-qr` storage buckets
- the seed gym with slug `fitdesk`

### 2. Provision the admin account

The admin account needs `profiles.is_admin = true` and a `gym_id`. Use the
provisioning script with a **service-role or secret key** supplied only through
the shell environment:

```powershell
$env:SUPABASE_URL="https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role or sb_secret_ key>"
$env:ADMIN_EMAIL="owner@example.com"
$env:ADMIN_PASSWORD="<preset password, 8+ characters>"
$env:ADMIN_NAME="Gym Owner"          # optional
npm.cmd run provision:admin
```

The script:

1. Finds or creates the Supabase Auth user.
2. Sets the preset password and confirms the email.
3. Marks the profile `is_admin = true`.
4. Binds the profile to the gym with slug `fitdesk` (override with `GYM_SLUG`).

It is safe to re-run; it resets the password to the value in `ADMIN_PASSWORD`.
Clear the variables afterwards:

```powershell
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY, Env:ADMIN_PASSWORD
```

---

## Feature map

| Route | Feature |
| --- | --- |
| `/login` | Preset email/password login, show/hide password, browser password save |
| `/dashboard` | Stats, shutter toggle, approval queue, interactive closure calendar |
| `/members` | Deduplicated member table, payment status, approve/deny workflow |
| `/packages` | Admin-only package create/edit/archive with month duration and INR price |
| `/payments` | UPI ID and/or payment QR upload |
| `/attendance` | Single gym-wide attendance QR: show, download, print, regenerate |
| `/profile` | Admin name, DOB, blood group, gender, one legal document |

### Authentication

Supabase Auth owns the password. The login form uses
`signInWithPassword`, persists the session in `localStorage`, and auto-refreshes
the token. The browser's own password manager is supported through a normal
`<form>` with `autocomplete="username"` and `autocomplete="current-password"`.
A "Save password" checkbox keeps the browser credential prompt available; the app
never stores the password itself.

Admin authorization is enforced twice:

- `is_admin()` is checked after login and on session restore.
- Every admin RPC is `SECURITY DEFINER` and raises `ADMIN_REQUIRED` unless
  `profiles.is_admin` is true for `auth.uid()`.

### Members and payment approval

`admin_list_members` returns one row per auth user by aggregating the latest
membership/payment state. `MembersPage` also deduplicates by `user_id` at the
render boundary, and the dashboard queue deduplicates by `payment_id`, so a
retried or duplicated response cannot render the same person twice.

Approving a payment calls `admin_review_payment`, which:

- marks the payment approved,
- activates or extends the membership,
- preserves remaining paid days on a renewal,
- records the reviewer and timestamp.

Denying always opens a confirmation dialog first and records a review note.

### Attendance QR

There is one QR for the whole gym. The token is stored in `gym_qr_codes`; the
member app resolves it through an RPC. The admin can:

- show the QR,
- download it as a PNG,
- print it,
- regenerate it now,
- set an automatic rotation interval (1, 3, 6, or 12 months).

Regeneration revokes the old token and creates one replacement. Check-in remains
one row per member per IST day.

### Shutter and closures

`admin_set_gym_open` updates `gyms.is_open` and `shutter_changed_at`.
`admin_set_closure` writes to `announcements` with `kind = 'closure'`, which is
already the member app's source of truth for holidays. Past dates are read-only;
future dates can be marked closed with an optional reason.

### Profile and legal document

The profile page updates `profiles` directly (owner-only RLS) and uploads the
single legal document to the private `legal-documents` bucket. Documents are
viewed through short-lived signed URLs. The document is mandatory: replacing it
requires uploading a new file, and removing it without a replacement is blocked
in both the UI and `saveMyProfile`.

---

## Security model

- The admin SPA only receives the publishable/anon key.
- No admin table is granted to `anon` or `authenticated` for direct writes.
  Every admin operation goes through an admin-checked `SECURITY DEFINER` RPC.
- Storage policies scope legal documents and payment QR files to the owning
  admin/gym.
- `is_admin` is not member-writable; only service-role/SQL tooling can set it.
- `vercel.json` adds `X-Frame-Options: DENY`, `nosniff`, and a strict referrer
  policy. The page is also `noindex, nofollow`.

---

## Future realtime / socket integration

`src/lib/sync.ts` is the single integration seam.

Every mutation currently emits a domain event:

```ts
emitAdminSync('payments')
emitAdminSync('members')
emitAdminSync('gym')
```

The bridge invalidates only the matching React Query caches. When the member app
and admin site are synced later, a Supabase Realtime channel or any socket
transport only needs to call:

```ts
emitAdminSync(domain)
```

with one of:

`gym | stats | packages | members | payments | closures | attendance | profile`

No page needs to know whether the update came from a local mutation or a remote
socket. Add the transport in one place and the UI stays consistent.

Suggested next step for the realtime phase:

1. Create a `RealtimeSyncProvider` that subscribes to Postgres changes (or a
   socket topic) on mount.
2. Map each table/topic to an `AdminSyncDomain`.
3. Call `emitAdminSync(domain)` on every change.
4. Keep the existing local mutation events as the optimistic path.

---

## Project structure

```
src/
  components/
    dashboard/    Shutter, approval queue, closure calendar
    layout/       Sidebar, mobile top bar, app shell
    ui/           Button, Input, Select, Modal, Badge, Card, ...
  context/        Auth provider and app providers
  lib/
    api/          Supabase RPC and storage wrappers per domain
    dedupe.ts     Render-boundary duplicate guards
    sync.ts       Future realtime seam
    format.ts     INR/date/UI formatting helpers
  pages/          Login, dashboard, members, packages, payments, attendance, profile
supabase/
  migrations/     Self-contained schema, RLS, storage, admin RPCs
scripts/
  provision-admin.mjs
```

---

## Verification

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Current tests cover the dedupe helper and formatting helpers. Full authenticated
UI verification requires the preset admin password; without it only the login
screen can be exercised locally.
