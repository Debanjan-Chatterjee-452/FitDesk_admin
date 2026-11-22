import { useEffect, useState } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Droplets,
  ExternalLink,
  FileText,
  Fingerprint,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react'
import type { JoinRequestRow } from '@/lib/api/joinRequests'
import { getAvatarSignedUrl, getDocumentSignedUrl } from '@/lib/api/profile'
import { formatDateOnly, formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
}

function ageFromDob(value: string | null): string {
  if (!value) return '—'
  const dob = new Date(value)
  if (Number.isNaN(dob.getTime())) return '—'
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1
  return `${age} yrs`
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line/70 bg-elevated/40 px-3 py-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-faint">{label}</p>
        <p className="mt-0.5 break-words text-[13px] font-medium text-ink">{value}</p>
      </div>
    </div>
  )
}

export function JoinRequestReviewModal({
  request,
  open,
  onClose,
  onApprove,
  onDecline,
  loading,
}: {
  request: JoinRequestRow | null
  open: boolean
  onClose: () => void
  onApprove: () => void
  onDecline: () => void
  loading: boolean
}) {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !request) return
    let cancelled = false
    setDocumentUrl(null)
    setAvatarUrl(null)
    setFileError(null)
    setLoadingFiles(true)

    const jobs: Promise<unknown>[] = []
    if (request.member_document_path) {
      jobs.push(
        getDocumentSignedUrl(request.member_document_path)
          .then((url) => {
            if (!cancelled) setDocumentUrl(url)
          })
          .catch(() => {
            if (!cancelled) setFileError('The uploaded document could not be opened. Try again.')
          }),
      )
    }
    if (request.member_avatar_path) {
      jobs.push(
        getAvatarSignedUrl(request.member_avatar_path)
          .then((url) => {
            if (!cancelled) setAvatarUrl(url)
          })
          .catch(() => undefined),
      )
    }

    void Promise.allSettled(jobs).then(() => {
      if (!cancelled) setLoadingFiles(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, request])

  if (!request) return null

  const documentName = request.member_document_name ?? ''
  const isPdf =
    request.member_document_mime_type === 'application/pdf' || /\.pdf$/i.test(documentName)
  // HEIC/HEIF cannot be rendered by desktop browsers; those fall back to the
  // "Open document" button like any other unsupported format.
  const isImage =
    !isPdf &&
    (request.member_document_mime_type?.startsWith('image/') ||
      /\.(jpe?g|png|webp)$/i.test(documentName))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Review join request"
      description="Check the member's details and identity document before deciding."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
          {request.status === 'pending' ? (
            <>
              <Button
                variant="danger"
                icon={<XCircle className="h-4 w-4" />}
                onClick={onDecline}
                disabled={loading}
              >
                Decline
              </Button>
              <Button
                icon={<BadgeCheck className="h-4 w-4" />}
                onClick={onApprove}
                loading={loading}
              >
                Approve member
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar name={request.member_name} src={avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">
              {request.member_name || 'Unnamed member'}
            </p>
            <p className="truncate text-xs text-muted">{request.user_email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  request.status === 'pending'
                    ? 'warning'
                    : request.status === 'approved'
                      ? 'success'
                      : 'danger'
                }
              >
                {request.status}
              </Badge>
              {request.member_profile_completed ? (
                <Badge tone="info" dot>
                  Profile complete
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <DetailRow
            icon={<Phone className="h-4 w-4" />}
            label="Phone"
            value={request.member_phone || 'Not provided'}
          />
          <DetailRow
            icon={<CalendarDays className="h-4 w-4" />}
            label="Date of birth"
            value={`${formatDateOnly(request.member_date_of_birth)} · ${ageFromDob(request.member_date_of_birth)}`}
          />
          <DetailRow
            icon={<UserRound className="h-4 w-4" />}
            label="Gender"
            value={
              request.member_gender
                ? (GENDER_LABELS[request.member_gender] ?? request.member_gender)
                : 'Not provided'
            }
          />
          <DetailRow
            icon={<Droplets className="h-4 w-4" />}
            label="Blood group"
            value={request.member_blood_group || 'Not provided'}
          />
          <DetailRow
            icon={<Mail className="h-4 w-4" />}
            label="Requested"
            value={formatDateTime(request.requested_at)}
          />
          <DetailRow
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Account"
            value={request.member_profile_completed ? 'Verified profile' : 'Incomplete profile'}
          />
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary-strong" />
            <p className="text-[13px] font-semibold text-ink">Identity document</p>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-primary-soft px-2.5 py-1 text-[12px] font-semibold text-primary">
              {request.member_document_type || 'Document type not provided'}
            </span>
            <span className="rounded-lg bg-elevated px-2.5 py-1 font-mono text-[12px] tracking-wide text-ink">
              {request.member_document_number || 'Number not provided'}
            </span>
          </div>

          {request.member_document_path ? (
            <div className="space-y-3">
              <p className="truncate text-[11px] text-muted">
                {request.member_document_name || 'Uploaded document'}
              </p>
              {loadingFiles ? (
                <div className="flex items-center gap-2 py-8 text-xs text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
                </div>
              ) : fileError ? (
                <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-soft p-3 text-xs text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {fileError}
                </div>
              ) : documentUrl && isPdf ? (
                <div className="space-y-2">
                  <iframe
                    src={documentUrl}
                    title="Member identity document"
                    className="h-[420px] w-full rounded-xl border border-line bg-elevated"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<ExternalLink className="h-4 w-4" />}
                    onClick={() => window.open(documentUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Open PDF in new tab
                  </Button>
                </div>
              ) : documentUrl && isImage ? (
                <div className="space-y-2">
                  <img
                    src={documentUrl}
                    alt="Member identity document"
                    className="max-h-[420px] w-full rounded-xl border border-line bg-elevated object-contain"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<ExternalLink className="h-4 w-4" />}
                    onClick={() => window.open(documentUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Open image in new tab
                  </Button>
                </div>
              ) : documentUrl ? (
                <Button
                  variant="outline"
                  icon={<FileText className="h-4 w-4" />}
                  onClick={() => window.open(documentUrl, '_blank', 'noopener,noreferrer')}
                >
                  Open document
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted">No document was uploaded with this request.</p>
          )}
        </div>

        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The document is private and shared only for verification. It is not shown to other
          members.
        </p>
      </div>
    </Modal>
  )
}
