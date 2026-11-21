import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, Mail, Pencil, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import type { GymAdminRow } from '@/lib/api/admins'
import {
  createGymAdmin,
  listGymAdmins,
  removeGymAdmin,
  updateGymAdmin,
} from '@/lib/api/admins'
import { useAuth } from '@/context/AuthContext'
import { toAppError } from '@/lib/errors'
import { adminKeys } from '@/lib/queryKeys'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { SectionLoader } from '@/components/ui/Spinner'

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type FormState = {
  fullName: string
  email: string
  phone: string
  password: string
}

const EMPTY_FORM: FormState = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
}

function validate(form: FormState, mode: 'create' | 'edit'): string | null {
  if (form.fullName.trim().length < 2) return 'Enter the admin’s full name.'
  if (mode === 'create' && !EMAIL_PATTERN.test(form.email.trim())) {
    return 'Enter a valid email address.'
  }
  if (mode === 'create' && form.password.length < 8) {
    return 'The password must be at least 8 characters.'
  }
  if (mode === 'edit' && form.password.length > 0 && form.password.length < 8) {
    return 'The new password must be at least 8 characters.'
  }
  return null
}

export function AdminsPanel() {
  const queryClient = useQueryClient()
  const { session, refreshProfile } = useAuth()
  const adminsQuery = useQuery({
    queryKey: adminKeys.admins(),
    queryFn: listGymAdmins,
  })

  const admins = adminsQuery.data ?? []
  const atLimit = admins.length >= 2

  const [mode, setMode] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<GymAdminRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<GymAdminRow | null>(null)

  const resetDialog = () => {
    setMode(null)
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  const closeDialog = () => {
    if (createMutation.isPending || updateMutation.isPending) return
    resetDialog()
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setMode('create')
  }

  const openEdit = (admin: GymAdminRow) => {
    setEditing(admin)
    setForm({
      fullName: admin.full_name ?? '',
      email: admin.email ?? '',
      phone: admin.phone ?? '',
      password: '',
    })
    setFormError(null)
    setMode('edit')
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createGymAdmin({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
      }),
    onSuccess: (result) => {
      toast.success(
        result.existing_user
          ? 'Existing account promoted to administrator.'
          : 'Administrator account created.',
      )
      resetDialog()
      void queryClient.invalidateQueries({ queryKey: adminKeys.admins() })
    },
    onError: (error) => setFormError(toAppError(error).message),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateGymAdmin({
        userId: editing?.user_id ?? '',
        fullName: form.fullName,
        phone: form.phone,
        password: form.password,
      }),
    onSuccess: async () => {
      toast.success('Administrator details updated.')
      const editedSelf = editing?.is_self === true
      resetDialog()
      await queryClient.invalidateQueries({ queryKey: adminKeys.admins() })
      if (editedSelf && session) await refreshProfile()
    },
    onError: (error) => setFormError(toAppError(error).message),
  })

  const removeMutation = useMutation({
    mutationFn: (admin: GymAdminRow) => removeGymAdmin(admin.user_id),
    onSuccess: () => {
      toast.success('Administrator access revoked.')
      setRemoveTarget(null)
      void queryClient.invalidateQueries({ queryKey: adminKeys.admins() })
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  const submit = () => {
    const error = validate(form, mode === 'edit' ? 'edit' : 'create')
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    if (mode === 'edit') updateMutation.mutate()
    else createMutation.mutate()
  }

  const removeBlockedReason = (admin: GymAdminRow): string | null => {
    if (admin.is_owner) return 'The gym owner cannot be removed.'
    if (admin.is_self) return 'You cannot remove your own access.'
    if (admins.length <= 1) return 'At least one administrator is required.'
    return null
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-ink">Admins &amp; team</p>
            <p className="mt-1 text-[10px] leading-5 text-muted">
              Up to two administrators can run this gym. Both have full access to members,
              payments and settings.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
          <Button
            size="sm"
            variant="outline"
            icon={<Plus className="h-4 w-4" />}
            onClick={openCreate}
            disabled={atLimit}
            title={atLimit ? 'This gym already has two administrators.' : undefined}
          >
            Add admin
          </Button>
          {atLimit ? (
            <span className="text-[9.5px] text-faint">Two-admin limit reached</span>
          ) : null}
        </div>
      </div>

      {adminsQuery.isLoading ? (
        <SectionLoader rows={2} />
      ) : adminsQuery.isError ? (
        <div className="flex flex-col items-start gap-2 px-5 py-4">
          <p className="text-[11px] text-danger">
            {toAppError(adminsQuery.error).message}
          </p>
          <Button size="sm" variant="outline" onClick={() => void adminsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {admins.map((admin) => {
            const blockedReason = removeBlockedReason(admin)
            return (
              <li
                key={admin.user_id}
                className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={admin.full_name} size="md" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[12px] font-semibold text-ink">
                        {admin.full_name || 'Unnamed administrator'}
                      </p>
                      {admin.is_owner ? (
                        <Badge tone="info">
                          <Crown className="h-3 w-3" /> Owner
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Admin</Badge>
                      )}
                      {admin.is_self ? <Badge tone="success">You</Badge> : null}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-muted">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{admin.email ?? 'No email'}</span>
                    </p>
                    {admin.phone ? (
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-faint">
                        <UserRound className="h-3 w-3 shrink-0" />
                        {admin.phone}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => openEdit(admin)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    disabled={Boolean(blockedReason)}
                    title={blockedReason ?? 'Revoke admin access'}
                    onClick={() => setRemoveTarget(admin)}
                    className="text-danger hover:text-danger"
                  >
                    Remove
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={mode !== null}
        onClose={closeDialog}
        title={mode === 'edit' ? 'Edit administrator' : 'Add a second administrator'}
        description={
          mode === 'edit'
            ? 'Update their display details or issue a new password.'
            : 'They can sign in to FitDesk Admin immediately with this email and password.'
        }
        size="sm"
        closeOnBackdrop={!createMutation.isPending && !updateMutation.isPending}
        footer={
          <>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {mode === 'edit' ? 'Save changes' : 'Create admin'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Full name"
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            placeholder="Backup administrator"
            autoComplete="off"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="backup.admin@example.com"
            disabled={mode === 'edit'}
            autoComplete="off"
          />
          <Input
            label="Phone (optional)"
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="98765 43210"
            autoComplete="off"
          />
          <Input
            label={mode === 'edit' ? 'New password (optional)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder={mode === 'edit' ? 'Leave blank to keep current' : 'At least 8 characters'}
            hint={
              mode === 'create'
                ? 'If this email already belongs to a member of this gym, their account is promoted and the password is reset.'
                : undefined
            }
            autoComplete="new-password"
          />
          {formError ? (
            <p className="rounded-xl bg-danger-soft px-3 py-2 text-[11px] font-medium text-danger">
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => {
          if (!removeMutation.isPending) setRemoveTarget(null)
        }}
        onConfirm={() => {
          if (removeTarget) removeMutation.mutate(removeTarget)
        }}
        title={`Revoke admin access for ${removeTarget?.full_name || 'this administrator'}?`}
        description="They will lose access to this gym’s admin suite immediately. Their profile, membership and payment history are preserved."
        confirmLabel="Revoke access"
        loading={removeMutation.isPending}
      />
    </Card>
  )
}
