import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  AlertCircle,
  BadgeCheck,
  Layers3,
  Pause,
  Pencil,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import type { PackageRow } from '@/types'
import { listAdminPackages, savePackage, setPackageActive } from '@/lib/api/packages'
import { toAppError } from '@/lib/errors'
import { cn, formatInr } from '@/lib/format'
import { adminKeys } from '@/lib/queryKeys'
import { emitAdminSync } from '@/lib/sync'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { SectionLoader } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'

const MONTH_OPTIONS = [1, 2, 3, 4, 6, 12, 18, 24]

const schema = z.object({
  months: z.string().min(1, 'Choose a duration.'),
  price: z.string().min(1, 'Enter a price.').refine((value) => Number(value) >= 1, 'Price must be at least ₹1.'),
  name: z.string().max(60, 'Keep the name under 60 characters.'),
  description: z.string().max(300, 'Keep the description under 300 characters.'),
  isRecommended: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  months: '1',
  price: '',
  name: '',
  description: '',
  isRecommended: false,
}

function PackageFormDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: PackageRow | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })

  useEffect(() => {
    if (!open) return
    reset(
      editing
        ? {
            months: String(editing.duration_months),
            price: String(editing.price_inr),
            name: editing.name,
            description: editing.description ?? '',
            isRecommended: editing.is_recommended,
          }
        : defaults,
    )
  }, [open, editing, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      savePackage({
        id: editing?.id,
        months: Number(values.months),
        priceInr: Number(values.price),
        name: values.name,
        description: values.description,
        isRecommended: values.isRecommended,
      }),
    onSuccess: (result) => {
      toast.success(editing ? `${result.name} updated.` : `${result.name} added to the plan list.`)
      onClose()
      emitAdminSync('packages')
      void queryClient.invalidateQueries({ queryKey: adminKeys.packages() })
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  return (
    <Modal
      open={open}
      onClose={mutation.isPending ? () => {} : onClose}
      title={editing ? 'Edit package' : 'Create a new package'}
      description={
        editing
          ? 'Changes appear in the member app as soon as they are saved.'
          : 'Set a simple month duration and price. Active plans sync to the FitDesk user app.'
      }
      closeOnBackdrop={!mutation.isPending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="package-form"
            loading={mutation.isPending}
            icon={!mutation.isPending ? <Plus className="h-4 w-4" /> : undefined}
          >
            {editing ? 'Save changes' : 'Create package'}
          </Button>
        </>
      }
    >
      <form
        id="package-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Month duration" error={errors.months?.message} {...register('months')}>
            {MONTH_OPTIONS.map((months) => (
              <option key={months} value={months}>
                {months} {months === 1 ? 'month' : 'months'}
              </option>
            ))}
          </Select>
          <Input
            label="Price (INR)"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="1500"
            error={errors.price?.message}
            {...register('price')}
          />
        </div>

        <Input
          label="Display name (optional)"
          placeholder="Quarterly"
          error={errors.name?.message}
          hint="Leave blank to use Monthly, Quarterly, Half-yearly, or Annual."
          {...register('name')}
        />

        <Textarea
          label="Description (optional)"
          placeholder="Three months of training, classes, and locker access."
          error={errors.description?.message}
          {...register('description')}
        />

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-elevated p-3.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-line text-primary accent-[#123C31]"
            {...register('isRecommended')}
          />
          <span>
            <span className="block text-[12px] font-semibold text-ink">Mark as recommended</span>
            <span className="mt-0.5 block text-[10px] leading-4 text-muted">
              Adds a subtle “recommended” label in the member app.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  )
}

function PackageCard({
  pkg,
  onEdit,
}: {
  pkg: PackageRow
  onEdit: (pkg: PackageRow) => void
}) {
  const queryClient = useQueryClient()
  const toggleMutation = useMutation({
    mutationFn: () => setPackageActive(pkg.id, !pkg.is_active),
    onSuccess: (result) => {
      toast.success(result.is_active ? `${pkg.name} is active again.` : `${pkg.name} archived.`)
      emitAdminSync('packages')
      void queryClient.invalidateQueries({ queryKey: adminKeys.packages() })
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
    },
    onError: (error) => toast.error(toAppError(error).message),
  })

  return (
    <Card
      className={cn(
        'group relative flex flex-col overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift',
        !pkg.is_active && 'opacity-70',
        pkg.is_recommended && pkg.is_active && 'border-[#D9ECB9]',
      )}
    >
      {pkg.is_recommended && pkg.is_active ? (
        <div className="absolute right-3 top-3">
          <Badge tone="success" className="bg-primary-soft text-primary">
            <Sparkles className="h-3 w-3" />
            Recommended
          </Badge>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
          <Layers3 className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            {pkg.duration_months} {pkg.duration_months === 1 ? 'month' : 'months'}
          </p>
          <p className="text-[10px] text-faint">{pkg.duration_days} days access</p>
        </div>
      </div>

      <h3 className="mt-5 text-xl font-semibold tracking-[-0.04em] text-ink">{pkg.name}</h3>
      <p className="mt-1.5 line-clamp-2 min-h-8 text-[11px] leading-4 text-muted">
        {pkg.description || 'No description added.'}
      </p>

      <div className="mt-5 flex items-end justify-between gap-2">
        <div>
          <p className="text-[28px] font-semibold leading-none tracking-[-0.055em] text-ink">
            {formatInr(pkg.price_inr)}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            about {formatInr(Math.round(pkg.price_inr / pkg.duration_months))} / month
          </p>
        </div>
        <Badge tone={pkg.is_active ? 'paid' : 'neutral'} dot>
          {pkg.is_active ? 'Active' : 'Archived'}
        </Badge>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          icon={<Pencil className="h-3.5 w-3.5" />}
          onClick={() => onEdit(pkg)}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1"
          loading={toggleMutation.isPending}
          icon={
            pkg.is_active ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )
          }
          onClick={() => toggleMutation.mutate()}
        >
          {pkg.is_active ? 'Archive' : 'Restore'}
        </Button>
      </div>
    </Card>
  )
}

export function PackagesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PackageRow | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const packagesQuery = useQuery({
    queryKey: adminKeys.packages(),
    queryFn: listAdminPackages,
  })

  const packages = useMemo(() => packagesQuery.data ?? [], [packagesQuery.data])
  const active = packages.filter((pkg) => pkg.is_active)
  const archived = packages.filter((pkg) => !pkg.is_active)
  const visible = showArchived ? packages : active

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (pkg: PackageRow) => {
    setEditing(pkg)
    setDialogOpen(true)
  }

  return (
    <div className="animate-fade-up space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Packages"
        title="Plans that do the selling."
        description="Only the admin can create or change membership packages. Active plans are what members see."
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Create package
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <BadgeCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-ink">Admin-only plan control</p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted">
              Prices are whole rupees. Month duration is converted to the day count used by the member app.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? 'secondary' : 'outline'}
            size="sm"
            icon={<Archive className="h-3.5 w-3.5" />}
            onClick={() => setShowArchived((value) => !value)}
          >
            {showArchived ? 'Hide archived' : `View archived (${archived.length})`}
          </Button>
        </div>
      </div>

      {packagesQuery.isLoading ? (
        <Card>
          <SectionLoader rows={4} />
        </Card>
      ) : packagesQuery.isError ? (
        <Card>
          <EmptyState
            icon={<AlertCircle className="h-5 w-5" />}
            title="Could not load packages"
            description={toAppError(packagesQuery.error).message}
            action={<Button onClick={() => void packagesQuery.refetch()}>Try again</Button>}
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers3 className="h-5 w-5" />}
            title={showArchived ? 'No archived packages' : 'No active packages'}
            description={
              showArchived
                ? 'Archived plans appear here once you pause an active package.'
                : 'Create the first plan so members have something to renew into.'
            }
            action={<Button onClick={openCreate}>Create package</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted">
              {showArchived
                ? `${packages.length} total plans`
                : `${active.length} active ${active.length === 1 ? 'plan' : 'plans'}`}
            </p>
            <p className="text-[10px] text-faint">Sorted by duration</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} onEdit={openEdit} />
            ))}
          </div>
        </>
      )}

      <PackageFormDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
