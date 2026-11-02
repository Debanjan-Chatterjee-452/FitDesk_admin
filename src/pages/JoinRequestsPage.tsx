import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, UserRound, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { listJoinRequests, pendingJoinRequestCount, reviewJoinRequest } from '@/lib/api/joinRequests'
import { toAppError } from '@/lib/errors'
import { adminKeys } from '@/lib/queryKeys'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLoader } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/Modal'

export function JoinRequestsPage() {
  const queryClient = useQueryClient()
  const [declineTarget, setDeclineTarget] = useState<string | null>(null)

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
                  <div className="min-w-0 space-y-1">
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
                    {request.member_phone ? (
                      <p className="truncate text-xs text-muted">{request.member_phone}</p>
                    ) : null}
                    <p className="text-xs text-muted">
                      Requested {request.requested_at ? formatDateTime(request.requested_at) : '—'}
                    </p>
                  </div>

                  {isPending ? (
                    <div className="flex shrink-0 gap-2">
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
