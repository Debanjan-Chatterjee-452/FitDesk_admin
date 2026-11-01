import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/format'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leadingIcon?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leadingIcon, trailing, id, className, ...props },
  ref,
) {
  const inputId = id ?? props.name
  return (
    <div className="w-full">
      {label ? (
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leadingIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-faint">
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'focus-ring h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink shadow-[0_1px_1px_rgba(16,40,31,0.02)] transition placeholder:text-faint hover:border-[#CBD3C7] focus:border-pine/40 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-muted',
            leadingIcon && 'pl-10',
            trailing && 'pr-11',
            error && 'border-danger/60 focus:border-danger',
            className,
          )}
          aria-invalid={Boolean(error) || undefined}
          {...props}
        />
        {trailing ? (
          <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>
        ) : null}
      </div>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  )
})
