import { NavLink } from 'react-router-dom'
import {
  CreditCard,
  LayoutDashboard,
  Layers3,
  LogOut,
  QrCode,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import type { AdminProfile } from '@/types'
import { cn } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const items = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/members', label: 'Members', icon: UsersRound },
  { to: '/packages', label: 'Packages', icon: Layers3 },
  { to: '/payments', label: 'Payment settings', icon: CreditCard },
  { to: '/attendance', label: 'Attendance QR', icon: QrCode },
  { to: '/profile', label: 'My profile', icon: UserRound },
]

export function SidebarContent({
  profile,
  email,
  onNavigate,
  onSignOut,
}: {
  profile: AdminProfile
  email: string
  onNavigate?: () => void
  onSignOut: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-[#0A2A22] text-white">
      <div className="flex items-center gap-3 px-6 pb-8 pt-7">
        <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-lime text-primary-ink shadow-[0_10px_30px_-12px_rgba(201,242,123,0.7)]">
          <span className="text-[16px] font-extrabold tracking-[-0.1em]">FD</span>
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-pine-deep bg-lime" />
        </div>
        <div>
          <p className="text-[15px] font-semibold tracking-[-0.03em]">FitDesk</p>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">Admin suite</p>
        </div>
      </div>

      <div className="px-4">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.045] px-3 py-2.5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
            <ShieldCheck className="h-3.5 w-3.5 text-lime" />
            Owner access
          </div>
          <p className="mt-1.5 truncate text-xs font-medium text-white/85">FitDesk Performance Club</p>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1 px-3" aria-label="Admin navigation">
        <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
          Workspace
        </p>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-lime text-primary-ink shadow-[0_8px_22px_-14px_rgba(201,242,123,0.75)]'
                  : 'text-white/62 hover:bg-white/[0.06] hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'h-[17px] w-[17px] transition',
                    isActive ? 'text-primary-ink' : 'text-white/40 group-hover:text-white/75',
                  )}
                  strokeWidth={2}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-5 border-t border-white/[0.08] p-4">
        <div className="mb-3 flex justify-center">
          <ThemeToggle onDark className="border-white/15 bg-white/[0.06]" />
        </div>
        <div className="rounded-xl bg-white/[0.045] p-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={profile.full_name} size="sm" className="bg-lime/15 text-lime ring-white/10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white/90">
                {profile.full_name ?? 'FitDesk Admin'}
              </p>
              <p className="truncate text-[10px] text-white/40">{email}</p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
