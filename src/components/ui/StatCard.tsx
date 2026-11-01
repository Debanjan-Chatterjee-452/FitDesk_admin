import type { ReactNode } from 'react'
import { cn } from '@/lib/format'
import { Card } from './Card'

export function StatCard({
  label,
  value,
  helper,
  icon,
  tone = 'default',
  className,
}: {
  label: string
  value: ReactNode
  helper?: ReactNode
  icon: ReactNode
  tone?: 'default' | 'lime' | 'dark'
  className?: string
}) {
  const tones = {
    default: 'bg-surface text-ink',
    lime: 'bg-lime-soft text-ink border-primary/20',
    dark: 'bg-primary text-primary-ink border-primary',
  }
  const iconTones = {
    default: 'bg-primary-soft text-primary',
    lime: 'bg-white/70 text-primary',
    dark: 'bg-white/10 text-lime',
  }
  return (
    <Card className={cn('p-5', tones[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn('text-xs font-semibold', tone === 'dark' ? 'text-primary-ink/60' : 'text-muted')}>
          {label}
        </p>
        <span className={cn('grid h-9 w-9 place-items-center rounded-xl', iconTones[tone])}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-[-0.05em]">{value}</p>
      {helper ? (
        <p className={cn('mt-2 text-[11px] font-medium', tone === 'dark' ? 'text-primary-ink/55' : 'text-muted')}>
          {helper}
        </p>
      ) : null}
    </Card>
  )
}
