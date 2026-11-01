import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Copy,
  Download,
  LoaderCircle,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from 'lucide-react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import type { AttendanceQrState } from '@/types'
import {
  getAttendanceQr,
  rotateAttendanceQr,
  setAttendanceRotation,
} from '@/lib/api/attendance'
import { toAppError } from '@/lib/errors'
import { cn, formatDateTime } from '@/lib/format'
import { adminKeys } from '@/lib/queryKeys'
import { emitAdminSync } from '@/lib/sync'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/Spinner'

function useQrDataUrl(token: string | null | undefined) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!token) {
      setDataUrl(null)
      return
    }
    setError(null)
    QRCode.toDataURL(token, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0A2A22', light: '#FFFFFF' },
    })
      .then((result) => {
        if (active) setDataUrl(result)
      })
      .catch(() => {
        if (active) setError('The QR image could not be generated.')
      })
    return () => {
      active = false
    }
  }, [token])

  return { dataUrl, error }
}

function AttendancePreview({
  state,
  onRegenerate,
  regenerating,
}: {
  state: AttendanceQrState
  onRegenerate: () => void
  regenerating: boolean
}) {
  const [copied, setCopied] = useState(false)
  const { dataUrl, error } = useQrDataUrl(state.qr?.token)
  const token = state.qr?.token ?? null

  const nextRotation = state.next_rotation_at ? new Date(state.next_rotation_at) : null
  const rotationDue = nextRotation ? nextRotation.getTime() <= Date.now() : false

  const download = () => {
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'fitdesk-attendance-qr.png'
    document.body.appendChild(link)
    link.click()
    link.remove()
    toast.success('Attendance QR downloaded.')
  }

  const print = () => {
    if (!dataUrl) return
    const printWindow = window.open('', '_blank', 'width=760,height=920')
    if (!printWindow) {
      toast.error('Allow pop-ups to print the attendance QR.')
      return
    }
    printWindow.document.write(`<!doctype html>
<html>
<head>
  <title>FitDesk Attendance QR</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fff; color: #0A2A22; }
    .sheet { width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 42px; }
    .card { width: 480px; border: 2px solid #123C31; border-radius: 28px; padding: 34px; text-align: center; }
    .brand { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 16px; background: #123C31; color: #C9F27B; font-weight: 800; letter-spacing: -1px; }
    h1 { margin: 18px 0 6px; font-size: 26px; letter-spacing: -1px; }
    p { margin: 0; color: #65716A; font-size: 13px; line-height: 1.6; }
    img { width: 340px; height: 340px; margin: 26px auto 18px; display: block; }
    .token { margin-top: 8px; font-family: ui-monospace, monospace; font-size: 10px; color: #65716A; word-break: break-all; }
    .foot { margin-top: 24px; padding-top: 18px; border-top: 1px solid #E3E7DE; font-size: 11px; color: #8E9992; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="card">
      <div class="brand">FD</div>
      <h1>Scan to check in</h1>
      <p>FitDesk Performance Club<br/>One scan marks today's attendance.</p>
      <img src="${dataUrl}" alt="FitDesk attendance QR" />
      <p>Open the FitDesk member app and scan this code at the front desk.</p>
      <div class="token">${token ?? ''}</div>
      <div class="foot">Printed from FitDesk Admin · ${new Date().toLocaleString('en-IN')}</div>
    </div>
  </div>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`)
    printWindow.document.close()
  }

  const copyToken = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      toast.success('QR token copied.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the token.')
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Attendance QR"
        description="One code for the whole gym. Members scan it once per day."
        action={
          <Badge tone={rotationDue ? 'warning' : 'paid'} dot>
            {rotationDue ? 'Rotation due' : 'Active'}
          </Badge>
        }
      />
      <div className="px-5 pb-6 sm:px-6">
        <div className="rounded-2xl border border-line bg-elevated p-5 sm:p-7">
          {state.qr && !token ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-warn/15 bg-warn-soft p-3.5 text-[11px] leading-5 text-warn">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This QR was created before the admin panel and its printable token is unavailable. Generate
              a fresh QR to show, download, or print it.
            </div>
          ) : null}

          {token ? (
            <div className="flex flex-col items-center">
              <div className="relative rounded-[28px] border border-line bg-surface p-4 shadow-[0_24px_60px_-38px_rgba(10,42,34,0.55)] sm:p-5">
                <div className="absolute left-5 top-5 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-primary" />
                <div className="absolute right-5 top-5 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-primary" />
                <div className="absolute bottom-5 left-5 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-primary" />
                <div className="absolute bottom-5 right-5 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-primary" />
                {dataUrl ? (
                  <img
                    src={dataUrl}
                    alt="FitDesk attendance QR code"
                    className="h-[210px] w-[210px] object-contain sm:h-[248px] sm:w-[248px]"
                  />
                ) : (
                  <div className="grid h-[210px] w-[210px] place-items-center sm:h-[248px] sm:w-[248px]">
                    <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                <div className="mt-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                    Scan · check in · train
                  </p>
                  <p className="mt-1 text-[13px] font-semibold tracking-[-0.02em] text-ink">
                    FitDesk Performance Club
                  </p>
                </div>
              </div>

              {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

              <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  variant="primary"
                  icon={<Download className="h-4 w-4" />}
                  onClick={download}
                  disabled={!dataUrl}
                >
                  Download PNG
                </Button>
                <Button
                  variant="outline"
                  icon={<Printer className="h-4 w-4" />}
                  onClick={print}
                  disabled={!dataUrl}
                >
                  Print QR
                </Button>
                <Button
                  variant="outline"
                  icon={<RefreshCw className="h-4 w-4" />}
                  loading={regenerating}
                  onClick={onRegenerate}
                >
                  Regenerate
                </Button>
              </div>

              <button
                type="button"
                onClick={copyToken}
                className="focus-ring mt-4 flex max-w-full items-center gap-2 rounded-lg bg-[#F0F2EB] px-3 py-2 text-[9px] font-medium text-muted transition hover:bg-[#E9ECE3] hover:text-ink"
                title="Copy QR token"
              >
                <span className="truncate font-mono">{token}</span>
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary-soft text-primary">
                <QrCode className="h-7 w-7" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-[-0.02em] text-ink">
                Generate the gym&apos;s first QR
              </h3>
              <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted">
                One gym-wide code. Members scan it at the front desk; the server records at most one
                check-in per member per IST day.
              </p>
              <Button
                className="mt-5"
                icon={<QrCode className="h-4 w-4" />}
                loading={regenerating}
                onClick={onRegenerate}
              >
                Generate attendance QR
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            {state.qr ? `Created ${formatDateTime(state.qr.created_at)}` : 'No QR generated yet'}
          </span>
          {nextRotation ? (
            <span className={cn(rotationDue ? 'font-semibold text-warn' : 'text-faint')}>
              Next rotation {formatDateTime(state.next_rotation_at)}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

function RotationCard({
  state,
  onChanged,
}: {
  state: AttendanceQrState
  onChanged: (next: AttendanceQrState) => void
}) {
  const queryClient = useQueryClient()
  const [months, setMonths] = useState(state.rotation_months)
  const mutation = useMutation({
    mutationFn: setAttendanceRotation,
    onSuccess: (next) => {
      setMonths(next.rotation_months)
      onChanged(next)
      toast.success('Rotation schedule updated.')
      emitAdminSync('attendance')
      void queryClient.invalidateQueries({ queryKey: adminKeys.attendance() })
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  return (
    <Card>
      <CardHeader
        title="Rotation schedule"
        description="A printed QR stays valid until you regenerate it. Plan a calm monthly, quarterly, or six-monthly cadence."
      />
      <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="grid grid-cols-2 gap-2">
          {[1, 3, 6, 12].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMonths(value)}
              className={cn(
                'focus-ring rounded-xl border px-3 py-3 text-left transition',
                months === value
                  ? 'border-primary bg-primary text-primary-ink'
                  : 'border-line bg-surface text-ink hover:border-primary/25 hover:bg-primary-soft/40',
              )}
            >
              <span className="block text-lg font-semibold tracking-[-0.04em]">
                {value === 1 ? 'Monthly' : value === 3 ? 'Quarterly' : value === 6 ? 'Half-yearly' : 'Yearly'}
              </span>
              <span className={cn('mt-0.5 block text-[10px]', months === value ? 'text-white/50' : 'text-muted')}>
                Every {value} {value === 1 ? 'month' : 'months'}
              </span>
            </button>
          ))}
        </div>
        <Button
          className="w-full"
          variant="secondary"
          loading={mutation.isPending}
          disabled={months === state.rotation_months}
          onClick={() => mutation.mutate(months)}
        >
          Save schedule
        </Button>
        <div className="flex items-start gap-2 rounded-xl bg-elevated p-3 text-[10px] leading-5 text-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          The dashboard shows a “rotation due” reminder when this window passes. Nothing changes
          automatically — an old printed QR keeps working until you confirm a regeneration.
        </div>
      </div>
    </Card>
  )
}

export function AttendancePage() {
  const queryClient = useQueryClient()
  const [confirmRotate, setConfirmRotate] = useState(false)

  const qrQuery = useQuery({
    queryKey: adminKeys.attendance(),
    queryFn: getAttendanceQr,
  })

  const rotateMutation = useMutation({
    mutationFn: () => rotateAttendanceQr('Front desk'),
    onSuccess: (next) => {
      queryClient.setQueryData(adminKeys.attendance(), next)
      setConfirmRotate(false)
      toast.success('New attendance QR generated. The previous QR is revoked.')
      emitAdminSync('attendance')
      void queryClient.invalidateQueries({ queryKey: adminKeys.attendance() })
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  const state = qrQuery.data
  const hasQr = Boolean(state?.qr)

  const rotationLabel = useMemo(() => {
    if (!state?.rotation_months) return 'periodically'
    if (state.rotation_months === 1) return 'monthly'
    if (state.rotation_months === 3) return 'quarterly'
    if (state.rotation_months === 6) return 'six-monthly'
    return 'yearly'
  }, [state?.rotation_months])

  return (
    <div className="animate-fade-up space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="One scan. One day."
        description="A single gym-wide QR replaces separate in/out codes. Print it once and rotate it on your own schedule."
        action={
          state?.qr ? (
            <Button
              variant="outline"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => setConfirmRotate(true)}
            >
              New QR
            </Button>
          ) : undefined
        }
      />

      {qrQuery.isLoading ? (
        <Card>
          <SectionLoader rows={5} />
        </Card>
      ) : qrQuery.isError || !state ? (
        <Card className="border-danger/20 bg-danger-soft p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-danger" />
            <div>
              <p className="text-sm font-semibold text-danger">Attendance QR could not be loaded.</p>
              <p className="mt-1 text-xs text-danger/75">{toAppError(qrQuery.error).message}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void qrQuery.refetch()}>
                Try again
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <AttendancePreview
            state={state}
            onRegenerate={() => (hasQr ? setConfirmRotate(true) : rotateMutation.mutate())}
            regenerating={rotateMutation.isPending}
          />

          <div className="space-y-4">
            <RotationCard
              state={state}
              onChanged={(next) => queryClient.setQueryData(adminKeys.attendance(), next)}
            />

            <Card className="bg-primary p-5 text-primary-ink">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-primary-ink">
                  <ScanLine className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">How the single QR works</p>
                  <ul className="mt-3 space-y-2 text-[11px] leading-5 text-white/55">
                    <li className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      One code is active for the gym at a time.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      The server records at most one check-in per member per IST day.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      Regenerating revokes the old print instantly.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      Recommended rotation: {rotationLabel}. Never daily.
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={confirmRotate}
        onClose={() => (rotateMutation.isPending ? undefined : setConfirmRotate(false))}
        title="Regenerate the attendance QR?"
        description="The current printed QR will stop working immediately. Download and replace the print at the front desk."
        size="sm"
        closeOnBackdrop={!rotateMutation.isPending}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmRotate(false)}
              disabled={rotateMutation.isPending}
            >
              Keep current QR
            </Button>
            <Button
              variant="danger"
              loading={rotateMutation.isPending}
              onClick={() => rotateMutation.mutate()}
            >
              Regenerate QR
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-warn/15 bg-warn-soft p-3.5 text-[11px] leading-5 text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Anyone with the old QR image will no longer be able to check in. The member app does not need
          an update — it validates the scanned token on the server.
        </div>
      </Modal>
    </div>
  )
}
