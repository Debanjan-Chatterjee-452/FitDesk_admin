import type { ReactNode } from 'react'
import { cn } from '@/lib/format'

type Tone = 'pending' | 'paid' | 'unpaid' | 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  pending: 'bg-warn-soft text-warn ring-warn/10',
  paid: 'bg-success-soft text-success ring-success/10',
  unpaid: 'bg-danger-soft text-danger ring-danger/10',
  neutral: 'bg-elevated text-muted ring-black/[0.03]',
  success: 'bg-success-soft text-success ring-success/10',
  warning: 'bg-warn-soft text-warn ring-warn/10',
  danger: 'bg-danger-soft text-danger ring-danger/10',
  info: 'bg-primary-soft text-primary ring-pine/10',
}

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  )
}

export function PaymentBadge({ status }: { status: 'Pending' | 'Paid' | 'Not Paid' }) {
  const tone: Tone = status === 'Paid' ? 'paid' : status === 'Pending' ? 'pending' : 'unpaid'
  return (
    <Badge tone={tone} dot>
      {status}
    </Badge>
  )
}
