import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleSlash2,
  LoaderCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { listClosures, setClosure } from '@/lib/api/dashboard'
import { toAppError } from '@/lib/errors'
import { cn, formatDateOnly, parseDateOnly } from '@/lib/format'
import { adminKeys } from '@/lib/queryKeys'
import { emitAdminSync } from '@/lib/sync'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Selection {
  date: string
  closed: boolean
  reason: string
}

export function ClosureCalendar() {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selection, setSelection] = useState<Selection | null>(null)

  const from = useMemo(() => format(startOfMonth(today), 'yyyy-MM-dd'), [today])
  const to = useMemo(() => format(endOfMonth(addMonths(today, 11)), 'yyyy-MM-dd'), [today])

  const closuresQuery = useQuery({
    queryKey: adminKeys.closures(from, to),
    queryFn: () => listClosures(from, to),
  })

  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: Selection) => setClosure(input.date, input.closed, input.reason),
    onSuccess: (result) => {
      toast.success(
        result.is_closed
          ? `${formatDateOnly(result.date)} marked closed.`
          : `${formatDateOnly(result.date)} is open again.`,
      )
      setSelection(null)
      emitAdminSync('closures')
      void queryClient.invalidateQueries({ queryKey: adminKeys.closures(from, to) })
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  const closureMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of closuresQuery.data ?? []) {
      map.set(row.closure_date.slice(0, 10), row.reason)
    }
    return map
  }, [closuresQuery.data])

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  )

  const upcoming = useMemo(
    () =>
      (closuresQuery.data ?? [])
        .filter((row) => {
          const date = parseDateOnly(row.closure_date)
          return date ? !isBefore(date, today) : false
        })
        .slice(0, 3),
    [closuresQuery.data, today],
  )

  const canGoBack = month > startOfMonth(today)
  const canGoForward = month < startOfMonth(addMonths(today, 11))

  const chooseDay = (day: Date) => {
    if (isBefore(day, today)) return
    if (!isSameMonth(day, month)) return
    const key = format(day, 'yyyy-MM-dd')
    const existing = closureMap.get(key)
    setSelection({
      date: key,
      closed: !existing,
      reason: existing ?? '',
    })
  }

  const selectedDate = selection ? parseDateOnly(selection.date) : null
  const selectedLabel = selectedDate ? format(selectedDate, 'd MMM yyyy') : 'this date'

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Closure calendar"
        description="Tap a future date to plan a holiday or maintenance day."
        action={
          <Badge tone="neutral" className="hidden sm:inline-flex">
            <CalendarDays className="h-3 w-3" />
            {format(month, 'MMM yyyy')}
          </Badge>
        }
      />

      <div className="px-5 pb-5 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-ink">{format(month, 'MMMM yyyy')}</p>
            <p className="mt-0.5 text-[10px] text-muted">Asia/Kolkata calendar</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => canGoBack && setMonth((value) => subMonths(value, 1))}
              disabled={!canGoBack}
              className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-35"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => canGoForward && setMonth((value) => addMonths(value, 1))}
              disabled={!canGoForward}
              className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-35"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="pb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-faint"
            >
              {day}
            </div>
          ))}

          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const inMonth = isSameMonth(day, month)
            const isPast = isBefore(day, today)
            const isToday = isSameDay(day, today)
            const isClosed = closureMap.has(key)
            const disabled = isPast || !inMonth

            return (
              <button
                key={key}
                type="button"
                onClick={() => chooseDay(day)}
                disabled={disabled}
                title={isClosed ? closureMap.get(key) : undefined}
                className={cn(
                  'focus-ring relative grid aspect-square min-h-9 place-items-center rounded-lg text-[11.5px] font-semibold transition-all',
                  !inMonth && 'invisible',
                  inMonth && !isPast && 'hover:-translate-y-0.5 hover:shadow-sm',
                  isClosed && 'bg-danger-soft text-danger ring-1 ring-inset ring-danger/10',
                  !isClosed && isToday && !isPast && 'bg-primary text-white shadow-[0_6px_18px_-10px_rgba(18,60,49,0.8)]',
                  !isClosed && !isToday && !isPast && 'text-ink hover:bg-surface',
                  isPast && 'cursor-not-allowed text-faint',
                )}
                aria-label={`${format(day, 'd MMMM yyyy')}${isClosed ? ', closed' : ''}`}
                aria-pressed={isClosed}
              >
                {format(day, 'd')}
                {isClosed ? (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-danger" />
                ) : isToday && !isPast ? (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-danger" />
            Closed
          </span>
          <span className="ml-auto hidden items-center gap-1 text-faint sm:flex">
            <CircleSlash2 className="h-3 w-3" />
            Past dates are locked
          </span>
        </div>
      </div>

      <div className="border-t border-line bg-elevated px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold text-ink">Upcoming closures</p>
          {closuresQuery.isFetching ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted" /> : null}
        </div>
        {closuresQuery.isLoading ? (
          <div className="mt-2 h-10 animate-pulse rounded-lg bg-elevated" />
        ) : upcoming.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-muted">No closures planned. The gym is open every day.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {upcoming.map((row) => (
              <div key={row.announcement_id} className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold text-ink">
                  {formatDateOnly(row.closure_date, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="max-w-[60%] truncate text-[10px] text-muted">{row.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(selection)}
        onClose={() => (mutation.isPending ? undefined : setSelection(null))}
        title={selection?.closed ? `Mark ${selectedLabel} closed?` : `Reopen ${selectedLabel}?`}
        description={
          selection?.closed
            ? 'Members will see the gym as closed and QR check-in will be blocked for this date.'
            : 'Members will be able to check in normally on this date again.'
        }
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setSelection(null)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={selection?.closed ? 'danger' : 'primary'}
              loading={mutation.isPending}
              onClick={() => selection && mutation.mutate(selection)}
            >
              {selection?.closed ? 'Mark closed' : 'Reopen gym'}
            </Button>
          </>
        }
      >
        {selection?.closed ? (
          <Textarea
            label="Reason (optional)"
            placeholder="Holiday, maintenance, staff training…"
            value={selection.reason}
            maxLength={160}
            onChange={(event) =>
              setSelection((current) => (current ? { ...current, reason: event.target.value } : current))
            }
            hint="This reason is shown on the dashboard and to members in the future sync."
          />
        ) : (
          <p className="rounded-xl bg-primary-soft px-4 py-3 text-xs leading-5 text-primary">
            Reopening removes the closure announcement for this date. This does not change the shutter
            status on the dashboard.
          </p>
        )}
      </Modal>
    </Card>
  )
}
