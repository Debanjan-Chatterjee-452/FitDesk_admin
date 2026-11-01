import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Layers3,
  Plus,
  QrCode,
  ScanLine,
  TrendingUp,
  UsersRound,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getDashboardStats, getGymSettings } from '@/lib/api/dashboard'
import { listPendingPayments } from '@/lib/api/members'
import { cn, formatDateOnly, formatInr, formatNumber, greeting } from '@/lib/format'
import { adminKeys } from '@/lib/queryKeys'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { ShutterCard } from '@/components/dashboard/ShutterCard'
import { ApprovalQueue } from '@/components/dashboard/ApprovalQueue'
import { ClosureCalendar } from '@/components/dashboard/ClosureCalendar'

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-danger/20 bg-danger-soft p-5">
      <p className="text-sm font-semibold text-danger">The overview could not be loaded.</p>
      <p className="mt-1 text-xs text-danger/75">Check your connection and try again.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </Card>
  )
}

export function DashboardPage() {
  const { session } = useAuth()
  const statsQuery = useQuery({ queryKey: adminKeys.stats(), queryFn: getDashboardStats })
  const gymQuery = useQuery({ queryKey: adminKeys.gym(), queryFn: getGymSettings })
  const pendingQuery = useQuery({
    queryKey: adminKeys.pendingPayments(),
    queryFn: listPendingPayments,
  })

  const firstName = session?.profile.full_name?.split(/\s+/)[0] ?? 'Admin'
  const stats = statsQuery.data
  const gym = gymQuery.data
  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const retryAll = () => {
    void statsQuery.refetch()
    void gymQuery.refetch()
    void pendingQuery.refetch()
  }

  const paymentConfigured = Boolean(gym?.upi_id || gym?.payment_qr_path)

  return (
    <div className="animate-fade-up space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow={todayLabel}
        title={`${greeting()}, ${firstName}.`}
        description="A clear view of the club: approvals, members, and the days ahead."
        action={
          <>
            <Link
              to="/members"
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-line hover:bg-elevated"
            >
              <UsersRound className="h-4 w-4 text-muted" />
              Members
            </Link>
            <Link
              to="/packages"
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink shadow-[0_10px_24px_-12px_rgb(var(--primary)/0.7)] transition hover:bg-primary-strong"
            >
              <Plus className="h-4 w-4" />
              New package
            </Link>
          </>
        }
      />

      {statsQuery.isError || gymQuery.isError ? <DashboardError onRetry={retryAll} /> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total members"
          value={stats ? formatNumber(stats.total_members) : '—'}
          helper="Unique accounts, never logins"
          icon={<UsersRound className="h-4 w-4" />}
        />
        <StatCard
          label="Active plans"
          value={stats ? formatNumber(stats.active_members) : '—'}
          helper={stats ? `${stats.expiring_soon} expiring this week` : 'Currently training'}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="lime"
        />
        <StatCard
          label="Awaiting approval"
          value={stats ? formatNumber(stats.pending_approvals) : '—'}
          helper="Verify UTRs before approving"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <StatCard
          label="Collected this month"
          value={stats ? formatInr(stats.revenue_month_inr) : '—'}
          helper="Approved payments only"
          icon={<Wallet className="h-4 w-4" />}
          tone="dark"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {gym ? (
          <ShutterCard gym={gym} />
        ) : (
          <Card className="min-h-[244px] animate-pulse bg-primary-soft/60" />
        )}
        <div className="xl:col-span-2">
          <ApprovalQueue
            pending={pendingQuery.data ?? []}
            loading={pendingQuery.isLoading}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <ClosureCalendar />

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Today at a glance"
              description="The numbers worth a glance before opening."
              action={<Badge tone="info">{formatDateOnly(stats?.today)}</Badge>}
            />
            <div className="divide-y divide-line border-t border-line">
              {[
                {
                  icon: ScanLine,
                  label: "Today's check-ins",
                  value: stats?.today_checkins ?? 0,
                  helper: 'One scan per member',
                },
                {
                  icon: CalendarClock,
                  label: 'Expiring in 7 days',
                  value: stats?.expiring_soon ?? 0,
                  helper: 'Send a renewal nudge',
                },
                {
                  icon: Layers3,
                  label: 'Active packages',
                  value: stats?.active_packages ?? 0,
                  helper: 'Visible in the user app',
                },
                {
                  icon: CheckCircle2,
                  label: 'Pending reviews',
                  value: stats?.pending_approvals ?? 0,
                  helper: 'Approve or deny in Members',
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F2F4ED] text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-ink">{item.label}</p>
                    <p className="text-[10px] text-muted">{item.helper}</p>
                  </div>
                  <p className="text-lg font-semibold tracking-[-0.04em] text-ink">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Setup</p>
                <h3 className="mt-1 text-sm font-semibold tracking-[-0.02em] text-ink">
                  Payment collection
                </h3>
              </div>
              <Badge tone={paymentConfigured ? 'paid' : 'warning'} dot>
                {paymentConfigured ? 'Ready' : 'Needs setup'}
              </Badge>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              {paymentConfigured
                ? 'At least one receiving method is live. Renewals can be verified from Members.'
                : 'Add a UPI ID or upload a payment QR so members know where to pay.'}
            </p>
            <div className="mt-4 grid gap-2">
              <Link
                to="/payments"
                className="focus-ring flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[12px] font-semibold text-ink transition hover:border-primary/25 hover:bg-primary-soft/40"
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted" />
                  Payment settings
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted" />
              </Link>
              <Link
                to="/attendance"
                className="focus-ring flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[12px] font-semibold text-ink transition hover:border-primary/25 hover:bg-primary-soft/40"
              >
                <span className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-muted" />
                  Attendance QR
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted" />
              </Link>
              <Link
                to="/packages"
                className="focus-ring flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[12px] font-semibold text-ink transition hover:border-primary/25 hover:bg-primary-soft/40"
              >
                <span className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-muted" />
                  Manage packages
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted" />
              </Link>
            </div>
            {gym ? (
              <div
                className={cn(
                  'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-medium',
                  gym.is_open ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {gym.is_open ? 'Shutter is open right now' : 'Shutter is down right now'}
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  )
}
