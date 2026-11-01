import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/format'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, hint, id, className, ...props }, ref) {
    const inputId = id ?? props.name
    return (
      <div className="w-full">
        {label ? (
          <label className="field-label" htmlFor={inputId}>
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'focus-ring min-h-24 w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink transition placeholder:text-faint hover:border-[#CBD3C7] focus:border-pine/40',
            error && 'border-danger/60',
            className,
          )}
          aria-invalid={Boolean(error) || undefined}
          {...props}
        />
        {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
      </div>
    )
  },
)
