import { useState } from 'react'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { saveBrowserPassword } from '@/lib/api/auth'
import { isSupabaseConfigured } from '@/lib/env'
import { toAppError } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Input } from '@/components/ui/Input'
import { FullPageLoader } from '@/components/ui/Spinner'

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your admin email.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  savePassword: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      savePassword: true,
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
          <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-warn-soft text-warn">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.03em]">Connect Supabase first</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Add <code className="rounded bg-elevated px-1.5 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{' '}
            <code className="rounded bg-elevated px-1.5 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>{' '}
            to <code className="rounded bg-elevated px-1.5 py-0.5 text-xs">.env.local</code>, then restart the
            dev server.
          </p>
        </div>
      </div>
    )
  }

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      const next = await signIn(values.email, values.password)

      if (values.savePassword) {
        const result = await saveBrowserPassword(values.email, values.password)
        if (result === 'saved') {
          toast.success('Password saved in this browser.')
        } else if (result === 'unsupported') {
          toast.info('Your browser will offer to save the password when you sign in.')
        } else {
          toast.warning('The browser could not save the password. Use its password manager manually.')
        }
      }

      navigate(next.isAdmin ? '/dashboard' : '/onboarding', { replace: true })
    } catch (error) {
      setFormError(toAppError(error).message)
    }
  }

  const savePasswordNow = async () => {
    const values = getValues()
    if (!values.email || !values.password) {
      toast.info('Enter your email and password first.')
      return
    }
    const result = await saveBrowserPassword(values.email, values.password)
    if (result === 'saved') {
      toast.success('Password saved in this browser.')
    } else if (result === 'unsupported') {
      toast.info('This browser uses its own password prompt instead.')
    } else {
      toast.warning('The password could not be saved. Try your browser password manager.')
    }
  }

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-[#0A2A22] px-12 py-10 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
        <div className="surface-grid absolute inset-0 opacity-70" />
        <div className="absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#2C6F58]/30 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-ink shadow-[0_16px_40px_-18px_rgba(201,242,123,0.9)]">
            <span className="text-[17px] font-extrabold tracking-[-0.1em]">FD</span>
          </div>
          <div>
            <p className="text-lg font-semibold tracking-[-0.04em]">FitDesk</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/40">Admin suite</p>
          </div>
        </div>

        <div className="relative my-auto max-w-xl py-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-ink">
            <Sparkles className="h-3.5 w-3.5" />
            One calm control room
          </div>
          <h1 className="text-[52px] font-semibold leading-[0.98] tracking-[-0.065em] xl:text-[58px]">
            Run the floor.
            <br />
            <span className="text-primary-ink">Not the clipboard.</span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-white/58">
            Payments, renewals, packages, attendance and closures — the whole gym in one considered
            workspace, built for the person at the front desk.
          </p>

          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
            {[
              ['Approvals', 'Review UPI payments in a click'],
              ['Members', 'One clean row per member'],
              ['Attendance', 'One QR, no in/out noise'],
              ['Closures', 'Plan holidays ahead'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
                <CheckCircle2 className="h-4 w-4 text-primary-ink" />
                <p className="mt-3 text-xs font-semibold text-white/90">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-white/40">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between border-t border-white/[0.08] pt-6 text-[10px] text-white/35">
          <span>FitDesk Performance Club</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin-only workspace
          </span>
        </div>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-7 sm:px-10 lg:justify-center lg:px-14 xl:px-24">
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-[12px] font-extrabold tracking-[-0.1em] text-primary-ink">
            FD
          </div>
          <div>
            <p className="text-base font-semibold tracking-[-0.04em]">FitDesk</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted">Admin suite</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[420px] lg:mx-0">
          <div className="mb-6 flex justify-end">
            <ThemeToggle />
          </div>
          <div className="mb-8">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface text-primary shadow-sm">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Welcome back</p>
            <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.05em] text-ink">
              Open your workspace.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Sign in with the email and password you chose when you registered your gym.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Admin email"
              type="email"
              autoComplete="username"
              placeholder="owner@fitdesk.in"
              leadingIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              leadingIcon={<KeyRound className="h-4 w-4" />}
              error={errors.password?.message}
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-line text-primary accent-[#123C31]"
                  {...register('savePassword')}
                />
                Save password in this browser
              </label>
              <button
                type="button"
                onClick={savePasswordNow}
                className="text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
              >
                Save password now
              </button>
            </div>

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
              <span>Enter admin suite</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-line bg-surface/60 px-4 py-3">
            <p className="flex items-start gap-2 text-[11px] leading-5 text-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Every gym owner uses their own email and password. FitDesk never shares an
              administrator password between gyms.
            </p>
          </div>

          <p className="mt-5 text-center text-xs text-muted lg:text-left">
            Running a new gym?{' '}
            <Link
              to="/register"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Create your gym account
            </Link>
          </p>

          <p className="mt-8 text-center text-[10px] text-faint lg:text-left">
            Protected by Supabase Auth · FitDesk Admin v1.0
          </p>
        </div>
      </section>
    </div>
  )
}
