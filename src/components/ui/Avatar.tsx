import { cn, initials } from '@/lib/format'

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string | null | undefined
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-16 w-16 text-lg',
  }
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-bold tracking-[-0.03em] text-primary ring-1 ring-inset ring-pine/5',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt={name ?? 'Member'} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  )
}
