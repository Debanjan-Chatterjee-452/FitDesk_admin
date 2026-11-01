import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Pause,
  Play,
  Trash2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { MemberRow, PaymentReviewResult } from '@/types'
import { cancelMembership, listMembers, pauseMembership, resumeMembership, reviewPayment } from '@/lib/api/members'
import { dedupeByKey } from '@/lib/dedupe'
import { toAppError } from '@/lib/errors'
import {
  cn,
  daysBetweenFromToday,
  formatDateOnly,
  formatDateTime,
  formatInr,
  formatNumber,
  pluralize,
} from '@/lib/format'
import { adminKeys } from '@/lib/queryKeys'
import { emitAdminSync } from '@/lib/sync'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, PaymentBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'

type Filter = 'all' | 'pending' | 'paid' | 'not_paid'
type Decision = 'approved' | 'declined'

const filterLabels: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All members' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'not_paid', label: 'Not paid' },
]

function RenewalCell({ member }: { member: MemberRow }) {
  if (!member.ends_on) {
    return <span className="text-[11px] text-faint">No active plan</span>
  }
  const days = daysBetweenFromToday(member.ends_on)
  const tone =
    days == null ? 'muted' : days < 0 ? 'text-danger' : days <= 7 ? 'text-warn' : 'text-muted'
  return (
    <div>
      <p className="text-[12px] font-semibold text-ink">{formatDateOnly(member.ends_on)}</p>
      <p className={cn('mt-0.5 text-[10px] font-medium', tone)}>
        {days == null
          ? '—'
          : days < 0
            ? `${Math.abs(days)} days overdue`
            : days === 0
              ? 'Ends today'
              : `${days} days left`}
      </p>
    </div>
  )
}

function MemberActions({
  member,
  onDecision,
  onMembershipAction,
}: {
  member: MemberRow
  onDecision: (member: MemberRow, decision: Decision) => void
  onMembershipAction: (member: MemberRow, type: 'cancel' | 'pause' | 'resume') => void
}) {
  const hasPending = member.payment_status === 'Pending' && !!member.pending_payment_id
  const status = member.membership_status

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasPending ? (
        <>
          <Button
            size="sm"
            variant="primary"
            icon={<Check className="h-3.5 w-3.5" />}
            onClick={() => onDecision(member, 'approved')}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-danger/20 text-danger hover:border-danger/30 hover:bg-danger-soft"
            icon={<X className="h-3.5 w-3.5" />}
            onClick={() => onDecision(member, 'declined')}
          >
            Deny
          </Button>
        </>
      ) : (
        <span className="text-[10px] font-medium text-faint">
          {member.payment_status === 'Paid' ? 'Settled' : 'No action'}
        </span>
      )}

      {member.membership_id && status !== 'cancelled' ? (
        <>
          {status === 'paused' ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<Play className="h-3.5 w-3.5" />}
              onClick={() => onMembershipAction(member, 'resume')}
            >
              Resume
            </Button>
          ) : status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              icon={<Pause className="h-3.5 w-3.5" />}
              onClick={() => onMembershipAction(member, 'pause')}
            >
              Pause
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="border-danger/20 text-danger hover:border-danger/30 hover:bg-danger-soft"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => onMembershipAction(member, 'cancel')}
          >
            Cancel
          </Button>
        </>
      ) : null}

      {status === 'cancelled' ? (
        <span className="text-[10px] font-semibold text-danger">Cancelled</span>
      ) : status === 'paused' ? (
        <span className="text-[10px] font-semibold text-warn">Paused</span>
      ) : null}
    </div>
  )
}

export function MembersPage() {
  const [params] = useSearchParams()
  const initialFilter: Filter = params.get('payment') === 'pending' ? 'pending' : 'all'
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MemberRow | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [note, setNote] = useState('')
  const [membershipAction, setMembershipAction] = useState<{ member: MemberRow; type: 'cancel' | 'pause' | 'resume' } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const queryClient = useQueryClient()

  const membersQuery = useQuery({
    queryKey: adminKeys.members(),
    queryFn: listMembers,
  })

  const mutation = useMutation({
    mutationFn: async (input: {
      member: MemberRow
      decision: Decision
      note: string
    }): Promise<PaymentReviewResult> => {
      if (!input.member.pending_payment_id) {
        throw new Error('This member has no pending payment to review.')
      }
      return reviewPayment(input.member.pending_payment_id, input.decision, input.note)
    },
    onSuccess: (result) => {
      if (result.status === 'approved') {
        toast.success(
          result.ends_on
            ? `${result.package_name} approved. Plan now runs to ${formatDateOnly(result.ends_on)}.`
            : `${result.package_name} approved and activated.`,
        )
      } else {
        toast.success('Payment denied. The member will need to submit a new payment.')
      }
      setSelected(null)
      setDecision(null)
      setNote('')
      emitAdminSync('payments')
      void queryClient.invalidateQueries({ queryKey: adminKeys.members() })
      void queryClient.invalidateQueries({ queryKey: adminKeys.pendingPayments() })
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  const membershipMutation = useMutation({
    mutationFn: async (input: { member: MemberRow; type: 'cancel' | 'pause' | 'resume'; reason: string }) => {
      const mid = input.member.membership_id
      if (!mid) throw new Error('This member has no membership to update.')
      if (input.type === 'cancel') return cancelMembership(mid, input.reason)
      if (input.type === 'pause') return pauseMembership(mid, input.reason)
      return resumeMembership(mid)
    },
    onSuccess: (_result, input) => {
      const label =
        input.type === 'cancel'
          ? 'Membership cancelled.'
          : input.type === 'pause'
            ? 'Membership paused.'
            : 'Membership resumed.'
      toast.success(label)
      setMembershipAction(null)
      setActionReason('')
      void queryClient.invalidateQueries({ queryKey: adminKeys.members() })
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  // Backend SQL is one-row-per-user; keep a second guard at the render boundary
  // so a stale retry or a future realtime patch cannot create duplicate rows.
  const members = useMemo(
    () => dedupeByKey(membersQuery.data ?? [], (member) => member.user_id),
    [membersQuery.data],
  )

  const counts = useMemo(
    () => ({
      all: members.length,
      pending: members.filter((member) => member.payment_status === 'Pending').length,
      paid: members.filter((member) => member.payment_status === 'Paid').length,
      not_paid: members.filter((member) => member.payment_status === 'Not Paid').length,
    }),
    [members],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return members.filter((member) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'pending' && member.payment_status === 'Pending') ||
        (filter === 'paid' && member.payment_status === 'Paid') ||
        (filter === 'not_paid' && member.payment_status === 'Not Paid')
      if (!matchesFilter) return false
      if (!needle) return true
      return [member.full_name, member.email, member.phone, member.plan_name, member.pending_reference]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [members, filter, search])

  const openDecision = (member: MemberRow, next: Decision) => {
    setSelected(member)
    setDecision(next)
    setNote('')
  }

  const closeDecision = () => {
    if (mutation.isPending) return
    setSelected(null)
    setDecision(null)
    setNote('')
  }

  return (
    <div className="animate-fade-up space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Members"
        title="The people on the floor."
        description="One row per account — not per login. Review payments, approve renewals, and keep plans current."
        action={
          <Button
            variant="outline"
            icon={<RefreshCw className={cn('h-4 w-4', membersQuery.isFetching && 'animate-spin')} />}
            onClick={() => void membersQuery.refetch()}
            disabled={membersQuery.isFetching}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {filterLabels.map((item) => {
          const active = filter === item.value
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                'focus-ring group rounded-2xl border p-4 text-left transition-all',
                active
                  ? 'border-primary bg-primary text-primary-ink shadow-[0_14px_30px_-22px_rgba(18,60,49,0.9)]'
                  : 'border-line bg-surface text-ink hover:border-primary/20 hover:bg-elevated',
              )}
            >
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-[0.14em]',
                  active ? 'text-white/50' : 'text-muted',
                )}
              >
                {item.value === 'not_paid' ? 'Not paid' : item.label.replace(' members', '')}
              </span>
              <span className="mt-2 block text-2xl font-semibold leading-none tracking-[-0.05em]">
                {membersQuery.isLoading ? '—' : formatNumber(counts[item.value])}
              </span>
              <span
                className={cn(
                  'mt-1.5 flex items-center gap-1 text-[10px]',
                  active ? 'text-white/45' : 'text-faint',
                )}
              >
                {item.value === 'all'
                  ? 'Deduplicated accounts'
                  : item.value === 'pending'
                    ? 'Needs a decision'
                    : item.value === 'paid'
                      ? 'Active or future plan'
                      : 'No active plan'}
              </span>
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="w-full sm:max-w-sm">
            <Input
              aria-label="Search members"
              placeholder="Search name, email, phone, or UTR…"
              leadingIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            {filter === 'all' ? 'All registered accounts' : `${filterLabels.find((f) => f.value === filter)?.label} filter`}
          </div>
        </div>

        {membersQuery.isLoading ? (
          <SectionLoader rows={5} />
        ) : membersQuery.isError ? (
          <EmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Could not load members"
            description={toAppError(membersQuery.error).message}
            action={<Button onClick={() => void membersQuery.refetch()}>Try again</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UserRoundSearch className="h-5 w-5" />}
            title={members.length === 0 ? 'No members yet' : 'No members match this view'}
            description={
              members.length === 0
                ? 'When someone registers in the FitDesk member app, they will appear here exactly once.'
                : 'Try a different search term or payment filter.'
            }
            action={
              members.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilter('all')
                    setSearch('')
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-elevated">
                    {['Member', 'Plan', 'Payment', 'Renewal', 'Action'].map((label) => (
                      <th
                        key={label}
                        className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-muted last:text-right"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((member) => (
                    <tr
                      key={member.user_id}
                      className={cn(
                        'border-b border-line/80 transition-colors last:border-0 hover:bg-[#FBFCF8]',
                        member.payment_status === 'Pending' && 'bg-warn-soft/25',
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={member.full_name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-ink">
                              {member.full_name}
                            </p>
                            <p className="truncate text-[10px] text-muted">
                              {member.email ?? member.phone ?? 'No contact'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="text-[12px] font-semibold text-ink">
                            {member.plan_name ?? 'No plan yet'}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            {member.membership_status === 'active' ? (
                              <Badge tone="success">{member.membership_status}</Badge>
                            ) : member.membership_status ? (
                              <Badge tone="neutral">{member.membership_status}</Badge>
                            ) : (
                              <span className="text-[10px] text-faint">Awaiting first plan</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <PaymentBadge status={member.payment_status} />
                        {member.payment_status === 'Pending' ? (
                          <p className="mt-1 max-w-[150px] truncate text-[9px] font-medium text-warn">
                            {member.pending_reference ?? 'No UTR'} · {formatInr(member.pending_amount_inr)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        <RenewalCell member={member} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <MemberActions member={member} onDecision={openDecision} onMembershipAction={(m, t) => { setMembershipAction({ member: m, type: t }); setActionReason(t === "cancel" ? "" : "Emergency") }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {filtered.map((member) => (
                <div
                  key={member.user_id}
                  className={cn(
                    'p-4',
                    member.payment_status === 'Pending' && 'bg-warn-soft/25',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={member.full_name} />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">{member.full_name}</p>
                        <p className="truncate text-[10px] text-muted">{member.email ?? member.phone}</p>
                      </div>
                    </div>
                    <PaymentBadge status={member.payment_status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-elevated p-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-faint">Plan</p>
                      <p className="mt-1 text-[11px] font-semibold text-ink">
                        {member.plan_name ?? 'No plan yet'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-faint">Renewal</p>
                      <RenewalCell member={member} />
                    </div>
                    {member.payment_status === 'Pending' ? (
                      <div className="col-span-2 border-t border-line pt-2">
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-faint">
                          Pending payment
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-ink">
                          {member.pending_plan_name ?? 'Plan'} · {formatInr(member.pending_amount_inr)} ·{' '}
                          {member.pending_reference ?? 'No UTR'}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[9px] text-faint">
                      <CalendarDays className="h-3 w-3" />
                      Joined {formatDateOnly(member.joined_at)}
                    </span>
                    <MemberActions member={member} onDecision={openDecision} onMembershipAction={(m, t) => { setMembershipAction({ member: m, type: t }); setActionReason(t === "cancel" ? "" : "Emergency") }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-line bg-elevated px-5 py-3 text-[10px] text-muted">
              <span>
                Showing <strong className="text-ink">{filtered.length}</strong> of{' '}
                <strong className="text-ink">{members.length}</strong> accounts
              </span>
              <span className="flex items-center gap-1">
                <UsersRound className="h-3.5 w-3.5" />
                {pluralize(counts.pending, 'approval')} waiting
              </span>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={Boolean(selected && decision)}
        onClose={closeDecision}
        title={
          decision === 'declined'
            ? 'Deny this payment?'
            : `Approve ${selected?.full_name ?? 'this member'}'s payment?`
        }
        description={
          decision === 'declined'
            ? 'This is a mandatory confirmation. Denying is irreversible and the member must submit a fresh payment.'
            : 'Confirm you have verified this UTR in your bank or UPI app. Approval activates the plan immediately.'
        }
        size="sm"
        closeOnBackdrop={!mutation.isPending}
        footer={
          <>
            <Button variant="outline" onClick={closeDecision} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              variant={decision === 'declined' ? 'danger' : 'primary'}
              loading={mutation.isPending}
              onClick={() => {
                if (!selected || !decision) return
                if (decision === 'declined' && !note.trim()) {
                  toast.info('Add a short reason before denying.')
                  return
                }
                mutation.mutate({ member: selected, decision, note })
              }}
            >
              {decision === 'declined' ? 'Yes, deny payment' : 'Approve & activate plan'}
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-elevated p-3.5">
              <Avatar name={selected.full_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{selected.full_name}</p>
                <p className="truncate text-[10px] text-muted">{selected.email}</p>
              </div>
              <PaymentBadge status={selected.payment_status} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-line p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-faint">Plan</p>
                <p className="mt-1 font-semibold text-ink">
                  {selected.pending_plan_name ?? selected.plan_name ?? 'Membership'}
                </p>
              </div>
              <div className="rounded-xl border border-line p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-faint">Amount</p>
                <p className="mt-1 font-semibold text-ink">{formatInr(selected.pending_amount_inr)}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-line p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-faint">UPI / UTR reference</p>
                <p className="mt-1 break-all font-mono text-[11px] font-semibold text-ink">
                  {selected.pending_reference ?? 'No reference submitted'}
                </p>
                <p className="mt-1 text-[9px] text-muted">
                  Submitted {formatDateTime(selected.pending_since)}
                </p>
              </div>
            </div>

            {decision === 'declined' ? (
              <div>
                <div className="flex items-start gap-2 rounded-xl border border-danger/15 bg-danger-soft p-3 text-[11px] leading-5 text-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  The member will see a declined payment and cannot reuse this reference. This action
                  cannot be undone.
                </div>
                <Textarea
                  className="mt-3"
                  label="Reason for denial"
                  placeholder="For example: UTR not found in the bank statement."
                  value={note}
                  maxLength={300}
                  onChange={(event) => setNote(event.target.value)}
                  hint="Stored in the payment review audit trail for the owner."
                />
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-success/15 bg-success-soft p-3 text-[11px] leading-5 text-success">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                The renewal period is recalculated server-side, preserving any remaining paid days.
                The member sees the updated dates immediately.
              </div>
            )}

            <p className="flex items-center gap-1.5 text-[10px] text-faint">
              <Clock3 className="h-3 w-3" />
              Review recorded against your admin account.
            </p>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!membershipAction}
        onClose={() => {
          if (membershipMutation.isPending) return
          setMembershipAction(null)
          setActionReason('')
        }}
        onConfirm={() => {
          if (!membershipAction) return
          const reason =
            membershipAction.type === 'cancel' || membershipAction.type === 'pause'
              ? actionReason.trim() || 'No reason provided'
              : 'Resumed by admin'
          membershipMutation.mutate({ member: membershipAction.member, type: membershipAction.type, reason })
        }}
        loading={membershipMutation.isPending}
        title={
          membershipAction?.type === 'cancel'
            ? `Cancel ${membershipAction.member.full_name}'s membership?`
            : membershipAction?.type === 'pause'
              ? `Pause ${membershipAction.member.full_name}'s membership?`
              : `Resume ${membershipAction?.member.full_name ?? ''}'s membership?`
        }
        description={
          membershipAction?.type === 'cancel'
            ? 'This cancels the membership immediately. Historical payments and attendance are preserved. No refund is issued automatically.'
            : membershipAction?.type === 'pause'
              ? 'The validity clock stops while paused. Remaining days are preserved and the expiry date extends when resumed. No late fees accrue while paused.'
              : 'Resume the membership and extend the expiry date by the paused duration.'
        }
        confirmLabel={
          membershipAction?.type === 'cancel'
            ? 'Cancel membership'
            : membershipAction?.type === 'pause'
              ? 'Pause membership'
              : 'Resume membership'
        }
        tone={membershipAction?.type === 'resume' ? 'primary' : 'danger'}
      >
        {membershipAction?.type === 'cancel' || membershipAction?.type === 'pause' ? (
          <div className="space-y-2">
            <label className="field-label" htmlFor="action-reason">
              Reason
            </label>
            <Textarea
              id="action-reason"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Enter a reason for this action"
            />
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
