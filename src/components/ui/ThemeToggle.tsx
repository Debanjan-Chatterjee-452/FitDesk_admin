import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '@/context/ThemeProvider'
import { cn } from '@/lib/format'

export function ThemeToggle({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const { mode, setMode } = useTheme()
  const options: { value: 'light' | 'dark' | 'system'; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ]
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border p-1',
        onDark
          ? 'border-white/15 bg-white/[0.06]'
          : 'border-line bg-elevated',
        className,
      )}
      role="radiogroup"
      aria-label="Theme"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          onClick={() => setMode(value)}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg transition-colors',
            onDark
              ? mode === value
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/55 hover:text-white'
              : mode === value
                ? 'bg-surface text-ink shadow-card'
                : 'text-muted hover:text-ink',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
