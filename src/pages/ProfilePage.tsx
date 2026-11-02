import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Droplets,
  Eye,
  FileText,
  LoaderCircle,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  VenusAndMars,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AdminProfile } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { requestPasswordReset } from '@/lib/api/auth'
import { getDocumentSignedUrl, getMyProfile, saveMyProfile } from '@/lib/api/profile'
import { toAppError } from '@/lib/errors'
import { todayInputValue } from '@/lib/format'
import { cn, formatDateOnly } from '@/lib/format'
import { adminKeys } from '@/lib/queryKeys'
import { emitAdminSync } from '@/lib/sync'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const

const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name.'),
  date_of_birth: z
    .string()
    .min(1, 'Choose your date of birth.')
    .refine((value) => value <= todayInputValue(), 'Date of birth cannot be in the future.'),
  blood_group: z.enum(BLOOD_GROUPS),
  gender: z.enum(GENDERS),
})

type FormValues = z.infer<typeof schema>

function initialValues(profile: AdminProfile): FormValues {
  return {
    full_name: profile.full_name ?? '',
    date_of_birth: profile.date_of_birth?.slice(0, 10) ?? '',
    blood_group: profile.blood_group ?? 'A+',
    gender: profile.gender ?? 'prefer_not_to_say',
  }
}

function DocumentPanel({
  profile,
  file,
  onFile,
}: {
  profile: AdminProfile
  file: File | null
  onFile: (file: File | null) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const openExisting = async () => {
    if (!profile.legal_document_path) return
    const popup = window.open('', '_blank')
    setOpening(true)
    try {
      const url = await getDocumentSignedUrl(profile.legal_document_path)
      if (popup) {
        popup.location.href = url
      } else {
        toast.error('Allow pop-ups to open the document.')
      }
    } catch (error) {
      popup?.close()
      toast.error(toAppError(error).message)
    } finally {
      setOpening(false)
    }
  }

  return (
    <div>
      <p className="field-label">Legal document</p>
      <div className="rounded-2xl border border-dashed border-line bg-elevated p-4">
        {file ? (
          <div className="flex items-center gap-3">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Legal document preview"
                className="h-14 w-14 rounded-xl border border-line bg-surface object-cover"
              />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-surface text-primary shadow-sm">
                <FileText className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-ink">{file.name}</p>
              <p className="mt-0.5 text-[10px] text-muted">
                {(file.size / 1024 / 1024).toFixed(2)} MB · ready to upload
              </p>
            </div>
            <button
              type="button"
              onClick={() => onFile(null)}
              className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger"
              aria-label="Remove selected document"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : profile.legal_document_path ? (
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-surface text-primary shadow-sm">
              <FileText className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-ink">
                {profile.legal_document_name ?? 'Uploaded legal document'}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-success">
                <CheckCircle2 className="h-3 w-3" />
                Stored securely
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={
                opening ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )
              }
              onClick={openExisting}
              disabled={opening}
            >
              View
            </Button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-primary-soft hover:text-primary"
              aria-label="Replace existing document"
              title="Replace document"
            >
              <UploadCloud className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center py-3 text-center"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface text-primary shadow-sm">
              <UploadCloud className="h-5 w-5" />
            </span>
            <span className="mt-2 text-[12px] font-semibold text-ink">Upload one document</span>
            <span className="mt-1 text-[10px] text-muted">
              PDF, JPG, PNG, WEBP, or HEIC · max 10 MB
            </span>
          </button>
        )}

        {!file && profile.legal_document_path ? (
          <p className="mt-3 text-center text-[10px] text-muted">
            One legal document is required. Use the replace button to upload a newer copy.
          </p>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null
            if (next && next.size > 10 * 1024 * 1024) {
              toast.error('The document must be 10 MB or smaller.')
            } else {
              onFile(next)
            }
            event.target.value = ''
          }}
        />
      </div>
      <p className="field-hint">
        Used for identity verification only. Stored in a private Supabase bucket and visible to this
        admin account.
      </p>
    </div>
  )
}

export function ProfilePage() {
  const { session, refreshProfile, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [documentFile, setDocumentFile] = useState<File | null>(null)

  const profileQuery = useQuery({
    queryKey: adminKeys.profile(),
    queryFn: () => getMyProfile(session!.userId),
    initialData: session!.profile,
  })

  const profile = profileQuery.data
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(profile),
  })

  useEffect(() => {
    reset(initialValues(profile))
    setDocumentFile(null)
  }, [profile, reset])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!profile.legal_document_path && !documentFile) {
        throw new Error('Upload one legal document before saving.')
      }
      return saveMyProfile({
        userId: session!.userId,
        full_name: values.full_name,
        date_of_birth: values.date_of_birth,
        blood_group: values.blood_group,
        gender: values.gender,
        legal_document_path: profile.legal_document_path,
        legal_document_name: profile.legal_document_name,
        legal_document_type: profile.legal_document_type,
        currentDocumentPath: profile.legal_document_path,
        documentFile,
      })
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(adminKeys.profile(), saved)
      setDocumentFile(null)
      await refreshProfile()
      reset(initialValues(saved))
      toast.success('Profile saved.')
      emitAdminSync('profile')
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  const fullName = profile.full_name ?? 'FitDesk Admin'

  return (
    <div className="animate-fade-up space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="My profile"
        title="Your account, in order."
        description="The legal name and identity details attached to the owner account."
        action={
          <Badge tone={profile.profile_completed ? 'paid' : 'warning'} dot>
            {profile.profile_completed ? 'Profile complete' : 'Complete your profile'}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader
            title="Personal details"
            description="These fields are stored on your admin profile, separate from member data."
          />
          <form
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                leadingIcon={<UserRound className="h-4 w-4" />}
                placeholder="Your legal name"
                error={errors.full_name?.message}
                {...register('full_name')}
              />
              <Input
                label="Date of birth"
                type="date"
                max={todayInputValue()}
                min="1900-01-01"
                leadingIcon={<CalendarDays className="h-4 w-4" />}
                error={errors.date_of_birth?.message}
                {...register('date_of_birth')}
              />
              <Select
                label="Blood group"
                error={errors.blood_group?.message}
                {...register('blood_group')}
              >
                {BLOOD_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </Select>
              <Select label="Gender" error={errors.gender?.message} {...register('gender')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </Select>
            </div>

            <div className="border-t border-line pt-5">
              <DocumentPanel
                profile={profile}
                file={documentFile}
                onFile={(file) => setDocumentFile(file)}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] text-faint">
                {isDirty || documentFile ? 'Unsaved changes' : 'Everything is up to date'}
              </p>
              <Button
                type="submit"
                icon={<Save className="h-4 w-4" />}
                loading={mutation.isPending}
                disabled={!isDirty && !documentFile}
              >
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative bg-primary p-5 text-primary-ink">
              <div className="surface-grid absolute inset-0 opacity-50" />
              <div className="relative flex items-center gap-3">
                <Avatar
                  name={fullName}
                  size="lg"
                  className="bg-primary text-primary-ink ring-4 ring-white/10"
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold tracking-[-0.03em]">{fullName}</p>
                  <p className="truncate text-[10px] text-white/45">{session?.email}</p>
                  <div className="mt-2 flex gap-1.5">
                    <Badge tone="paid" className="bg-primary text-primary-ink ring-0">
                      <ShieldCheck className="h-3 w-3" />
                      Owner
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="divide-y divide-line">
              {[
                { icon: Mail, label: 'Login email', value: session?.email ?? '—' },
                { icon: Droplets, label: 'Blood group', value: profile.blood_group ?? '—' },
                {
                  icon: VenusAndMars,
                  label: 'Gender',
                  value:
                    profile.gender === 'prefer_not_to_say'
                      ? 'Prefer not to say'
                      : profile.gender
                        ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
                        : '—',
                },
                {
                  icon: CalendarDays,
                  label: 'Date of birth',
                  value: formatDateOnly(profile.date_of_birth),
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-5 py-3">
                  <row.icon className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-faint">
                      {row.label}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-ink">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line bg-elevated px-5 py-3">
              <p className="flex items-center gap-1.5 text-[10px] text-muted">
                <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                Admin access verified by Supabase
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-ink">Password & session</p>
                <p className="mt-1 text-[10px] leading-5 text-muted">
                  Your password is managed by Supabase. Request a secure reset link by email, or sign out of this device.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Mail className="h-4 w-4" />}
                    onClick={async () => {
                      try {
                        await requestPasswordReset(session?.email ?? '')
                        toast.success('Password reset email sent. Check your inbox.')
                      } catch (error) {
                        toast.error(toAppError(error).message)
                      }
                    }}
                  >
                    Send reset link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<LogOut className="h-4 w-4" />}
                    onClick={() => void signOut()}
                  >
                    Sign out
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {!profile.profile_completed ? (
            <div className={cn('rounded-2xl border border-warn/15 bg-warn-soft p-4 text-[11px] leading-5 text-warn')}>
              Complete all fields and upload a legal document to finish your admin profile.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
