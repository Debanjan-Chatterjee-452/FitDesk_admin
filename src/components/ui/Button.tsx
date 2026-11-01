import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/format'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'lime'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-[0_10px_24px_-12px_rgb(var(--primary)/0.7)] hover:bg-primary-strong active:bg-primary-ink',
  secondary: 'bg-primary-soft text-primary hover:bg-primary-soft active:bg-[#D2E3D7]',
  outline: 'border border-line bg-surface text-ink hover:border-line hover:bg-elevated',
  ghost: 'bg-transparent text-muted hover:bg-elevated hover:text-ink',
  danger: 'bg-danger text-white hover:bg-[#AD392F] active:bg-[#972F26]',
  lime: 'bg-lime text-primary-ink hover:bg-lime-strong active:bg-[#A6DD4C]',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 rounded-lg px-3 text-[12.5px] gap-1.5',
  md: 'h-11 rounded-xl px-4 text-sm gap-2',
  lg: 'h-12 rounded-xl px-5 text-[15px] gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'focus-ring inline-flex select-none items-center justify-center font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}
