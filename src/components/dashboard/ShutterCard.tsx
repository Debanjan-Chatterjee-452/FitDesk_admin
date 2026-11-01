import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock3, Power, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { GymSettings } from '@/types'
import { setGymOpen } from '@/lib/api/dashboard'
import { toAppError } from '@/lib/errors'
import { cn, formatDateTime } from '@/lib/format'
import { adminKeys } from '@/lib/queryKeys'
import { emitAdminSync } from '@/lib/sync'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Toggle } from '@/components/ui/Toggle'

export function ShutterCard({ gym }: { gym: GymSettings }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: setGymOpen,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.gym() })
      const previous = queryClient.getQueryData<GymSettings>(adminKeys.gym())
      if (previous) {
        queryClient.setQueryData<GymSettings>(adminKeys.gym(), {
          ...previous,
          is_open: next,
        })
      }
      return { previous }
    },
    onError: (error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(adminKeys.gym(), context.previous)
      toast.error(toAppError(error).message)
    },
    onSuccess: (result) => {
      toast.success(result.is_open ? 'Gym is now open.' : 'Shutter is down — gym marked closed.')
    },
    onSettled: () => {
      emitAdminSync('gym')
    },
  })

  const isOpen = gym.is_open

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-0 p-0 text-white',
        isOpen ? 'bg-[#123C31]' : 'bg-[#0A2A22]',
      )}
    >
      <div className="surface-grid absolute inset-0 opacity-60" />
      <div
        className={cn(
          'absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl transition-colors duration-500',
          isOpen ? 'bg-lime/20' : 'bg-primary-strong/40',
        )}
      />

      <div className="relative flex h-full min-h-[244px] flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">The shutter</p>
            <h2 className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.045em]">
              {isOpen ? 'Gym is open' : 'Shutter down'}
            </h2>
            <p className="mt-2 max-w-[240px] text-xs leading-5 text-white/50">
              {isOpen
                ? 'Members can train. Keep this on during staffed hours.'
                : 'Front desk is closed. Members will see a closed gym when sync ships.'}
            </p>
          </div>
          <span
            className={cn(
              'grid h-10 w-10 place-items-center rounded-xl ring-1 ring-inset',
              isOpen ? 'bg-lime text-pine-ink ring-lime/30' : 'bg-white/10 text-white/60 ring-white/10',
            )}
          >
            <Power className="h-[18px] w-[18px]" />
          </span>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <Toggle
              checked={isOpen}
              onChange={(next) => mutation.mutate(next)}
              disabled={mutation.isPending}
              label="Open or close the gym"
              className={isOpen ? 'bg-lime' : 'bg-white/20'}
            />
            <div>
              <Badge
                tone={isOpen ? 'paid' : 'unpaid'}
                dot
                className={cn(
                  'border-0 ring-0',
                  isOpen ? 'bg-lime text-pine-ink' : 'bg-white/10 text-white/70',
                )}
              >
                {isOpen ? 'Open now' : 'Closed'}
              </Badge>
              <p className="mt-1.5 flex items-center gap-1 text-[10px] text-white/35">
                <Clock3 className="h-3 w-3" />
                {gym.shutter_changed_at
                  ? `Changed ${formatDateTime(gym.shutter_changed_at)}`
                  : 'Not changed yet'}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/40 sm:flex">
            <ShieldCheck className="h-3 w-3 text-lime" />
            Owner control
          </div>
        </div>
      </div>
    </Card>
  )
}
