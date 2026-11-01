import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/format'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('h-5 w-5 animate-spin text-primary', className)} />
}

export function FullPageLoader({ label = 'Loading your workspace' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-lime shadow-lift">
          <span className="text-lg font-extrabold tracking-[-0.08em]">FD</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {label}
        </div>
      </div>
    </div>
  )
}

export function SectionLoader({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 p-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton h-14 w-full" />
      ))}
    </div>
  )
}
