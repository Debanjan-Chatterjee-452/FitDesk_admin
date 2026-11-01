import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowRight, Building2, LogOut, Phone, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { completeOwnerOnboarding, readPendingOwnerDetails } from '@/lib/api/auth'
import { toAppError } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const schema = z.object({
  gymName: z.string().trim().min(2, 'Enter your gym name.').max(80, 'Keep it under 80 characters.'),
  fullName: z.string().trim().min(2, 'Enter the owner’s full name.'),
  phone: z
    .string()
    .trim()
    .max(15, 'Enter a valid mobile number.')
    .regex(/^[0-9+\s-]*$/, 'Use digits only.'),
})

type FormValues = z.infer<typeof schema>

export function OnboardingPage() {
  const { session, reload, signOut } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { gymName: '', fullName: '', phone: '' },
  })

  useEffect(() => {
    let active = true
    readPendingOwnerDetails()
      .then((details) => {
        if (!active) return
        reset({
          gymName: details?.gymName ?? '',
          fullName: details?.fullName ?? session?.profile.full_name ?? '',
          phone: details?.phone ?? session?.profile.phone ?? '',
        })
      })
      .catch(() => {
        /* prefill is best-effort */
      })
    return () => {
      active = false
    }
  }, [reset, session?.profile.full_name, session?.profile.phone])

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      await completeOwnerOnboarding({
        gymName: values.gymName,
        fullName: values.fullName,
        phone: values.phone,
      })
      await reload()
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(toAppError(error).message)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-[480px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-[12px] font-extrabold tracking-[-0.1em] text-primary-ink">
            FD
          </div>
          <div>
            <p className="text-base font-semibold tracking-[-0.04em]">FitDesk</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted">
              Gym setup
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              One last step
            </p>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.05em] text-ink">
              Name your gym.
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              This creates your gym, makes you its administrator and sets up your four UPI payment
              rails. You can change every detail afterwards.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Gym name"
              autoComplete="organization"
              placeholder="Iron Temple Fitness"
              leadingIcon={<Building2 className="h-4 w-4" />}
              error={errors.gymName?.message}
              {...register('gymName')}
            />
            <Input
              label="Owner’s full name"
              autoComplete="name"
              placeholder="Riya Sharma"
              leadingIcon={<User className="h-4 w-4" />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <Input
              label="Mobile number"
              type="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              leadingIcon={<Phone className="h-4 w-4" />}
              error={errors.phone?.message}
              hint="Optional, but useful for payment queries."
              {...register('phone')}
            />

            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-danger/15 bg-danger-soft px-3.5 py-3 text-xs leading-5 text-danger"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            ) : null}

            <Button type="submit" size="lg" loading={isSubmitting} className="w-full justify-between">
              <span>Create my gym</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
            <p className="truncate text-[11px] text-muted">{session?.email}</p>
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
