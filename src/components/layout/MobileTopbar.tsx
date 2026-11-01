import { useQuery } from '@tanstack/react-query'
import { Menu, ShieldCheck } from 'lucide-react'
import { adminKeys } from '@/lib/queryKeys'
import { getGymSettings } from '@/lib/api/dashboard'
import { Badge } from '@/components/ui/Badge'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function MobileTopbar({ onMenu }: { onMenu: () => void }) {
  const gym = useQuery({ queryKey: adminKeys.gym(), queryFn: getGymSettings })

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur-md lg:hidden">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink shadow-sm"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-[10px] font-extrabold tracking-[-0.08em] text-lime">
            FD
          </span>
          <div>
            <p className="text-[12px] font-semibold leading-tight text-ink">FitDesk Admin</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Owner suite</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
        {gym.data ? (
          <Badge tone={gym.data.is_open ? 'paid' : 'unpaid'} dot>
            {gym.data.is_open ? 'Open' : 'Closed'}
          </Badge>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure
          </span>
        )}
      </div>
    </header>
  )
}
