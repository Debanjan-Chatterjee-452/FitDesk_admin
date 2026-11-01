import { cn } from '@/lib/format'

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  size = 'md',
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'focus-ring relative inline-flex shrink-0 items-center rounded-full transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'md' ? 'h-7 w-12' : 'h-6 w-10',
        checked ? 'bg-lime' : 'bg-[#CBD3C7]',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white shadow-sm transition-transform duration-300',
          size === 'md' ? 'h-5 w-5' : 'h-4 w-4',
          checked
            ? size === 'md'
              ? 'translate-x-6'
              : 'translate-x-5'
            : 'translate-x-1',
        )}
      />
    </button>
  )
}
