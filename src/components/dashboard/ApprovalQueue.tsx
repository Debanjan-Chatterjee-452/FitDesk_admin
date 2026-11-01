import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCheck, Inbox } from 'lucide-react'
import type { PendingPayment } from '@/types'
import { dedupeByKey } from '@/lib/dedupe'
import { formatDateTime, formatInr } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLoader } from '@/components/ui/Spinner'

export function ApprovalQueue({
  pending,
  loading,
}: {
  pending: PendingPayment[]
  loading: boolean
}) {
  const uniquePending = dedupeByKey(pending, (payment) => payment.payment_id)
  const visible = uniquePending.slice(0, 4)

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Approvals waiting"
        description="Verify the UTR in your bank or UPI app before approving."
        action={
          <Link
            to="/members"
            className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary-soft"
          >
            View members
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {loading ? (
        <SectionLoader rows={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CheckCheck className="h-5 w-5" />}
          title="Nothing waiting"
          description="New UPI payments will appear here the moment a member submits a reference."
          className="py-10"
        />
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {visible.map((payment) => (
            <div key={payment.payment_id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
              <Avatar name={payment.member_name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13px] font-semibold text-ink">{payment.member_name}</p>
                  <Badge tone="pending">Pending</Badge>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  {payment.package_name} · {payment.provider_payment_id ?? 'No reference'}
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[13px] font-semibold text-ink">{formatInr(payment.total_amount_inr)}</p>
                <p className="text-[10px] text-faint">{formatDateTime(payment.created_at)}</p>
              </div>
              <Link
                to="/members?payment=pending"
                className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:border-primary/25 hover:bg-primary-soft hover:text-primary"
                aria-label={`Review ${payment.member_name}'s payment`}
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
          {uniquePending.length > visible.length ? (
            <div className="flex items-center gap-2 px-5 py-3 text-[11px] font-medium text-muted sm:px-6">
              <Inbox className="h-3.5 w-3.5" />
              {uniquePending.length - visible.length} more waiting in Members.
            </div>
          ) : null}
        </div>
      )}
    </Card>
  )
}
