import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AtSign,
  CheckCircle2,
  CreditCard,
  Image as ImageIcon,
  QrCode,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  UploadCloud,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import type { GymPaymentMethod, PaymentMethodKey } from '@/types'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ORDER } from '@/types'
import { getGymSettings } from '@/lib/api/dashboard'
import { getPaymentMethods, paymentQrPublicUrl, savePaymentMethod } from '@/lib/api/settings'
import { toAppError } from '@/lib/errors'
import { cn, formatDateTime } from '@/lib/format'
import { adminKeys } from '@/lib/queryKeys'
import { emitAdminSync } from '@/lib/sync'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/Spinner'

const UPI_PATTERN = /^[a-z0-9][a-z0-9._-]{1,60}@[a-z][a-z0-9]{1,40}$/

const METHOD_ICONS: Record<PaymentMethodKey, typeof Wallet> = {
  google_pay: Wallet,
  phonepe: Smartphone,
  paytm: CreditCard,
  upi: QrCode,
}

interface MethodCardProps {
  gymId: string
  gymName: string
  method: PaymentMethodKey
  data: GymPaymentMethod
  onSaved: (methods: GymPaymentMethod[]) => void
}

function PaymentMethodCard({ gymId, gymName, method, data, onSaved }: MethodCardProps) {
  const [enabled, setEnabled] = useState(data.is_enabled)
  const [upiId, setUpiId] = useState(data.upi_id ?? '')
  const [payeeName, setPayeeName] = useState(data.payee_name ?? '')
  const [qrFile, setQrFile] = useState<File | null>(null)
  const [clearQr, setClearQr] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastSyncedRef = useRef<string | null>(data.updated_at)

  useEffect(() => {
    if (lastSyncedRef.current === data.updated_at) return
    lastSyncedRef.current = data.updated_at
    setEnabled(data.is_enabled)
    setUpiId(data.upi_id ?? '')
    setPayeeName(data.payee_name ?? '')
    setQrFile(null)
    setClearQr(false)
  }, [data])

  useEffect(() => {
    if (!qrFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(qrFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [qrFile])

  const existingQrUrl = paymentQrPublicUrl(data.qr_path)
  const effectiveQrUrl = previewUrl ?? (clearQr ? null : existingQrUrl)
  const hasUpi = Boolean(upiId.trim())
  const hasQr = Boolean(effectiveQrUrl)

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanUpi = upiId.trim().toLowerCase()
      if (cleanUpi && !UPI_PATTERN.test(cleanUpi)) {
        throw new Error('Enter a valid UPI ID, for example gym@okhdfcbank.')
      }
      if (enabled && !cleanUpi && !hasQr) {
        throw new Error('Add a UPI ID, upload a QR, or switch this method off.')
      }

      return savePaymentMethod({
        gymId,
        method,
        isEnabled: enabled,
        upiId: cleanUpi,
        payeeName,
        currentQrPath: data.qr_path,
        qrFile,
        clearQr,
      })
    },
    onSuccess: (methods) => {
      setQrFile(null)
      setClearQr(false)
      toast.success(`${PAYMENT_METHOD_LABELS[method]} settings saved.`)
      onSaved(methods)
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  const acceptFile = (file: File | undefined | null) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Upload a PNG, JPG, or WEBP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('The QR image must be 5 MB or smaller.')
      return
    }
    setQrFile(file)
    setClearQr(false)
  }

  const Icon = METHOD_ICONS[method]

  return (
    <Card>
      <CardHeader
        title={PAYMENT_METHOD_LABELS[method]}
        description={
          method === 'upi'
            ? 'A general UPI handle for any app. Also used by older member-app builds.'
            : `Members who pay with ${PAYMENT_METHOD_LABELS[method]} see these details.`
        }
        action={
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={`Enable ${PAYMENT_METHOD_LABELS[method]}`}
            onClick={() => setEnabled((value) => !value)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition',
              enabled ? 'bg-primary' : 'bg-[#D6DBD0]',
            )}
          >
            <span
              className={cn(
                'inline-block h-4.5 w-4.5 transform rounded-full bg-surface shadow transition',
                enabled ? 'translate-x-6' : 'translate-x-1',
              )}
              style={{ height: 18, width: 18 }}
            />
          </button>
        }
      />

      <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'grid h-9 w-9 place-items-center rounded-xl',
              enabled ? 'bg-primary-soft text-primary' : 'bg-[#F0F2EB] text-faint',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <Badge tone={enabled ? 'paid' : 'neutral'} dot>
            {enabled ? 'Enabled for members' : 'Hidden from members'}
          </Badge>
        </div>

        <Input
          label="UPI ID"
          placeholder={method === 'upi' ? 'gym-owner@okhdfcbank' : `${method}@okhdfcbank`}
          leadingIcon={<AtSign className="h-4 w-4" />}
          value={upiId}
          onChange={(event) => setUpiId(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          hint="Optional if you upload a QR. You can use both together."
        />

        <Input
          label="Payee name"
          placeholder={gymName}
          value={payeeName}
          onChange={(event) => setPayeeName(event.target.value)}
          hint="Optional. Defaults to the gym name."
        />

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            acceptFile(event.dataTransfer.files?.[0])
          }}
          className={cn(
            'flex min-h-[168px] flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center transition',
            dragging ? 'border-primary bg-primary-soft' : 'border-line bg-elevated hover:border-primary/35',
          )}
        >
          {effectiveQrUrl ? (
            <div className="w-full">
              <img
                src={effectiveQrUrl}
                alt={`${PAYMENT_METHOD_LABELS[method]} QR preview`}
                className="mx-auto h-32 w-32 rounded-xl border border-line bg-surface object-contain p-2 shadow-sm"
              />
              <p className="mt-3 truncate text-[10px] text-muted">
                {qrFile ? qrFile.name : 'Current QR code'}
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<UploadCloud className="h-3.5 w-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-danger-soft hover:text-danger"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setQrFile(null)
                    setClearQr(true)
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-surface text-primary shadow-sm">
                <QrCode className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[12px] font-semibold text-ink">Drop a QR image here</p>
              <p className="mt-1 max-w-[240px] text-[10px] leading-4 text-muted">
                Optional. A UPI ID alone is enough, or use both together.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                icon={<ImageIcon className="h-3.5 w-3.5" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose image
              </Button>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            acceptFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={hasUpi ? 'paid' : 'neutral'}>
              <AtSign className="h-3 w-3" />
              UPI {hasUpi ? 'on' : 'off'}
            </Badge>
            <Badge tone={hasQr ? 'paid' : 'neutral'}>
              <QrCode className="h-3 w-3" />
              QR {hasQr ? 'on' : 'off'}
            </Badge>
          </div>
          <Button
            size="sm"
            icon={<Save className="h-3.5 w-3.5" />}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save
          </Button>
        </div>

        <p className="text-[10px] text-faint">
          Last saved {data.updated_at ? formatDateTime(data.updated_at) : 'never'}
        </p>
      </div>
    </Card>
  )
}

export function PaymentSettingsPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: adminKeys.gym(), queryFn: getGymSettings })
  const methodsQuery = useQuery({
    queryKey: adminKeys.paymentMethods(),
    queryFn: getPaymentMethods,
  })

  const applyMethods = (methods: GymPaymentMethod[]) => {
    queryClient.setQueryData(adminKeys.paymentMethods(), methods)
    void queryClient.invalidateQueries({ queryKey: adminKeys.gym() })
    emitAdminSync('gym')
  }

  const settings = settingsQuery.data
  const methods = methodsQuery.data

  if (settingsQuery.isLoading || methodsQuery.isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Payments" title="Where the money lands." />
        <Card>
          <SectionLoader rows={5} />
        </Card>
      </div>
    )
  }

  if (settingsQuery.isError || methodsQuery.isError || !settings || !methods) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Payments" title="Where the money lands." />
        <Card className="border-danger/20 bg-danger-soft p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-danger" />
            <div>
              <p className="text-sm font-semibold text-danger">Payment settings could not be loaded.</p>
              <p className="mt-1 text-xs text-danger/75">
                {toAppError(settingsQuery.error ?? methodsQuery.error).message}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  void settingsQuery.refetch()
                  void methodsQuery.refetch()
                }}
              >
                Try again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const byMethod = new Map(methods.map((item) => [item.method, item]))
  const enabledCount = methods.filter((item) => item.is_enabled).length
  const configuredCount = methods.filter(
    (item) => item.upi_id || item.qr_path,
  ).length

  return (
    <div className="animate-fade-up space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Payments"
        title="Where the money lands."
        description="Configure Google Pay, PhonePe, Paytm and General UPI independently. Each method can show a UPI ID, a QR code, or both. Members only ever see the methods you enable."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {PAYMENT_METHOD_ORDER.map((method) => {
          const data = byMethod.get(method)
          if (!data) return null
          return (
            <PaymentMethodCard
              key={method}
              gymId={settings.gym_id}
              gymName={settings.name}
              method={method}
              data={data}
              onSaved={applyMethods}
            />
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card
          className={cn('p-5', enabledCount > 0 ? 'bg-success-soft/50' : 'bg-warn-soft/50')}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                enabledCount > 0 ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn',
              )}
            >
              {enabledCount > 0 ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">
                {enabledCount > 0
                  ? `${enabledCount} payment ${enabledCount === 1 ? 'method' : 'methods'} live`
                  : 'Payment receiving is not set up'}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                {enabledCount > 0
                  ? 'Members see only these methods in the renewal flow. Nothing is marked paid until you verify the UTR in your bank statement.'
                  : 'Enable at least one method and save. Until then, members cannot renew from the app.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PAYMENT_METHOD_ORDER.map((method) => {
                  const item = byMethod.get(method)
                  return (
                    <Badge key={method} tone={item?.is_enabled ? 'paid' : 'neutral'}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </Badge>
                  )
                })}
              </div>
              <p className="mt-3 text-[10px] text-muted">
                {configuredCount} of 4 configured · gym id {settings.gym_id.slice(0, 8)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Direct UPI, human verified</p>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                FitDesk never stores card details and never calls a payment gateway. The member pays
                your UPI ID or scans your QR, submits the reference, and you approve it from the
                Members table. Cash payments are verified the same way.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-elevated px-3 py-2">
                <span className="text-[10px] text-muted">Gym settings updated</span>
                <span className="text-[10px] font-semibold text-ink">
                  {formatDateTime(settings.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
