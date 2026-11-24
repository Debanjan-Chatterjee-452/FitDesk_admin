import { cn } from '@/lib/format'
import { FitDeskIcon } from './FitDeskLogo'

interface LogoProps {
  className?: string
  markClassName?: string
  showWordmark?: boolean
  subtitle?: string
  inverted?: boolean
}

/** Compact header branding using the exact emblem from the official SVG. */
export function Logo({
  className,
  markClassName,
  showWordmark = true,
  subtitle,
  inverted,
}: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <FitDeskIcon
        className={cn(
          'h-10 w-10 shrink-0',
          inverted ? 'text-white' : 'text-primary',
          markClassName,
        )}
      />
      {showWordmark ? (
        <div className="leading-none">
          <span
            className={cn(
              'text-[19px] font-semibold tracking-[-0.04em]',
              inverted ? 'text-white' : 'text-ink',
            )}
          >
            FitDesk
          </span>
          {subtitle ? (
            <span
              className={cn(
                'mt-1 block text-[9px] font-bold uppercase tracking-[0.24em]',
                inverted ? 'text-white/50' : 'text-muted',
              )}
            >
              {subtitle}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
