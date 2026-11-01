import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { signUpOwner } from '@/lib/api/auth'
import { isSupabaseConfigured } from '@/lib/env'
import { toAppError } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { FullPageLoader } from '@/components/ui/Spinner'

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the owner’s full name.'),
    gymName: z.string().trim().min(2, 'Enter your gym name.').max(80, 'Keep it under 80 characters.'),
    email: z.string().trim().min(1, 'Enter your email.').email('Enter a valid email address.'),
    phone: z
      .string()
      .trim()
      .min(10, 'Enter a 10-digit mobile number.')
      .max(15, 'Enter a valid mobile number.')
      .regex(/^[0-9+\s-]+$/, 'Use digits only.'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .regex(/[A-Z]/, 'Add an uppercase letter.')
      .regex(/[a-z]/, 'Add a lowercase letter.')
      .regex(/[0-9]/, 'Add a number.')
      .regex(/[^A-Za-z0-9]/, 'Add a special character.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })

type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const { session, loading, reload } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      gymName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  })

  if (loading) return <FullPageLoader label="Checking secure session" />
  if (session) {
    return <Navigate to={session.isAdmin ? '/dashboard' : '/onboarding'} replace />
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg p-6">
        <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-7 shadow-card">
          <h1 className="text-xl font-semibold tracking-[-0.03em]">Connect Supabase first</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Add <code className="rounded bg-[#F0F2EB] px-1.5 py-0.5 text-xs">VITE_SUPABASE_URL</code>{' '}
            and{' '}
            <code className="rounded bg-[#F0F2EB] px-1.5 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>{' '}
            to <code className="rounded bg-[#F0F2EB] px-1.5 py-0.5 text-xs">.env.local</code>.
          </p>
        </div>
      </div>
    )
  }

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      const result = await signUpOwner({
        fullName: values.fullName,
        gymName: values.gymName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      })

      if (result.needsEmailConfirmation) {
        setSentTo(values.email.trim().toLowerCase())
        return
      }

      // signUp created a live session outside the auth context; adopt it
      // before routing so OnboardingRoute sees a signed-in user.
      await reload()
      navigate('/onboarding', { replace: true })
    } catch (error) {
      setFormError(toAppError(error).message)
    }
  }

  if (sentTo) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg p-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 shadow-card">
          <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-success-soft text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.03em]">Confirm your email</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            We sent a confirmation link to <strong className="text-ink">{sentTo}</strong>. Open it,
            then sign in to finish setting up your gym.
          </p>
          <Link
            to="/login"
            className="focus-ring mt-5 inline-flex h-12 w-full items-center justify-between rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-ink shadow-[0_10px_24px_-12px_rgb(var(--primary)/0.7)] transition hover:bg-primary-strong"
          >
            <span>Go to sign in</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg px-5 py-10 sm:px-8">
      <div className="fixed right-4 top-4 z-30">
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-[520px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-[12px] font-extrabold tracking-[-0.1em] text-primary-ink">
            FD
          </div>
          <div>
            <p className="text-base font-semibold tracking-[-0.04em]">FitDesk</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted">Admin suite</p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">New gym</p>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.05em] text-ink">
              Create your gym account.
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Use the gym owner’s own email. Your gym, members and payments stay completely
              separate from every other gym on FitDesk.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Owner’s full name"
              autoComplete="name"
              placeholder="Riya Sharma"
              leadingIcon={<User className="h-4 w-4" />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <Input
              label="Gym name"
              autoComplete="organization"
              placeholder="Iron Temple Fitness"
              leadingIcon={<Building2 className="h-4 w-4" />}
              error={errors.gymName?.message}
              {...register('gymName')}
            />

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="owner@yourgym.in"
              leadingIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Mobile number"
              type="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              leadingIcon={<Phone className="h-4 w-4" />}
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 10 characters"
              leadingIcon={<KeyRound className="h-4 w-4" />}
              error={errors.password?.message}
              hint="Upper and lower case, a number and a special character."
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-faint transition hover:bg-elevated hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              {...register('password')}
            />

            <Input
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat your password"
              leadingIcon={<KeyRound className="h-4 w-4" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
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
              <span>Create gym account</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-elevated px-4 py-3">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="text-[11px] leading-5 text-muted">
              You choose this password. FitDesk never sets a shared administrator password, and no
              other gym can see your data.
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
