import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Droplets,
  RefreshCw,
  ScanEye,
  UserRound,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  listJoinRequests,
  pendingJoinRequestCount,
  reviewJoinRequest,
  type JoinRequestRow,
} from '@/lib/api/joinRequests'
import { toAppError } from '@/lib/errors'
import { adminKeys } from '@/lib/queryKeys'
import { formatDateOnly, formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/Modal'
import { JoinRequestReviewModal } from '@/components/joinRequests/JoinRequestReviewModal'

export function JoinRequestsPage() {
  const queryClient = useQueryClient()
  const [declineTarget, setDeclineTarget] = useState<string | null>(null)
  const [reviewTarget, setReviewTarget] = useState<JoinRequestRow | null>(null)

  const requestsQuery = useQuery({
    queryKey: [...adminKeys.all, 'join-requests'],
    queryFn: listJoinRequests,
    staleTime: 15_000,
  })

  const pendingCountQuery = useQuery({
    queryKey: [...adminKeys.all, 'join-requests-count'],
    queryFn: pendingJoinRequestCount,
    staleTime: 15_000,
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewJoinRequest(id, approve),
    onSuccess: (_data, variables) => {
      toast.success(variables.approve ? 'Member approved.' : 'Request declined.')
      setReviewTarget(null)
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'join-requests'] })
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, 'join-requests-count'] })
    },
    onError: (error) => {
      toast.error(toAppError(error).message)
    },
  })

  const rows = (requestsQuery.data ?? []).slice().sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return (b.requested_at ?? '').localeCompare(a.requested_at ?? '')
  })

  const pendingCount = pendingCountQuery.data ?? rows.filter((r) => r.status === 'pending').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Join requests"
        description="Approve or decline members who asked to join your gym."
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => {
              void requestsQuery.refetch()
              void pendingCountQuery.refetch()
            }}
          >
            Refresh
          </Button>
        }
      />

      {pendingCount > 0 ? (
        <div className="rounded-xl border border-primary/20 bg-primary-soft/40 px-4 py-3 text-sm text-ink">
          {pendingCount} pending request{pendingCount === 1 ? '' : 's'} waiting for review.
        </div>
      ) : null}

      {requestsQuery.isLoading ? (
        <SectionLoader rows={4} />
      ) : requestsQuery.isError ? (
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Could not load join requests"
          description={toAppError(requestsQuery.error).message}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<UserRound className="h-5 w-5" />}
          title="No join requests yet"
          description="Members who request to join your gym will appear here."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((request) => {
            const isPending = request.status === 'pending'
            return (
              <Card key={request.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted" />
                      <p className="truncate text-sm font-semibold text-ink">
                        {request.member_name || 'Unnamed member'}
                      </p>
                      <Badge tone={isPending ? 'warning' : request.status === 'approved' ? 'success' : 'danger'}>
                        {request.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted">{request.user_email}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                      {request.member_phone ? <span>{request.member_phone}</span> : null}
                      {request.member_date_of_birth ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatDateOnly(request.member_date_of_birth)}
                        </span>
                      ) : null}
                      {request.member_blood_group ? (
                        <span className="inline-flex items-center gap-1">
                          <Droplets className="h-3 w-3" />
                          {request.member_blood_group}
                        </span>
                      ) : null}
                    </div>
                    {request.member_document_path ||
                    request.member_document_type ||
                    request.member_document_number ? (
                      <div className="space-y-2 rounded-xl border border-line/70 bg-elevated/40 p-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-semibold text-ink">
                            {request.member_document_type ?? 'Legal document'}
                          </span>
                          {request.member_document_number ? (
                            <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-ink">
                              {request.member_document_number}
                            </span>
                          ) : (
                            <span className="text-muted">Number not provided</span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<ScanEye className="h-4 w-4" />}
                          onClick={() => setReviewTarget(request)}
                        >
                          Review details &amp; document
                        </Button>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted">
                      Requested {request.requested_at ? formatDateTime(request.requested_at) : '—'}
                    </p>
                  </div>

                  {isPending ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<ScanEye className="h-4 w-4" />}
                        onClick={() => setReviewTarget(request)}
                      >
                        Review
                      </Button>
                      <Button
                        size="sm"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        loading={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: request.id, approve: true })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<XCircle className="h-4 w-4" />}
                        loading={reviewMutation.isPending}
                        onClick={() => setDeclineTarget(request.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <Clock3 className="h-4 w-4 text-muted" />
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <JoinRequestReviewModal
        request={reviewTarget}
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        onApprove={() => {
          if (reviewTarget) reviewMutation.mutate({ id: reviewTarget.id, approve: true })
        }}
        onDecline={() => {
          if (reviewTarget) reviewMutation.mutate({ id: reviewTarget.id, approve: false })
        }}
        loading={reviewMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(declineTarget)}
        onClose={() => setDeclineTarget(null)}
        onConfirm={() => {
          if (declineTarget) {
            reviewMutation.mutate({ id: declineTarget, approve: false })
            setDeclineTarget(null)
          }
        }}
        loading={reviewMutation.isPending}
        title="Decline this request?"
        description="The member will be able to request again later."
        confirmLabel="Decline"
        tone="danger"
      />
    </div>
  )
}
