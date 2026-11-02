import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { updatePassword } from '@/lib/api/auth'
import { toAppError } from '@/lib/errors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

type Phase = 'checking' | 'ready' | 'invalid'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [phase, setPhase] = useState<Phase>('checking')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    let active = true
    const supabase = (window as unknown as { __supabase?: unknown }).__supabase
    void supabase
    const check = async () => {
      try {
        const { getSupabase } = await import('@/lib/supabase')
        const client = getSupabase()
        const { data } = await client.auth.getSession()
        if (!active) return
        if (data.session) {
          setPhase('ready')
        } else {
          setLinkError('This page needs a valid password reset link. Request a new one from your profile.')
          setPhase('invalid')
        }
      } catch {
        if (!active) return
        setLinkError('Could not verify the reset link.')
        setPhase('invalid')
      }
    }
    void check()
    return () => {
      active = false
    }
  }, [])

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      await updatePassword(values.password)
      await signOut()
      toast.success('Password updated. Sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (error) {
      setFormError(toAppError(error).message)
    }
  }

  if (phase === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-5 py-10">
        <Card className="w-full max-w-[420px] p-6 text-center">
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted">Verifying your reset link…</p>
        </Card>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-5 py-10">
        <Card className="w-full max-w-[420px] p-6">
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/15 bg-danger-soft px-3.5 py-3 text-xs leading-5 text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{linkError}</p>
          </div>
          <Button className="mt-4 w-full" onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-5 py-10">
      <Card className="w-full max-w-[420px] p-6">
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Password reset</p>
          <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.05em] text-ink">Set a new password</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Choose a new password for your FitDesk admin account.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            leadingIcon={<KeyRound className="h-4 w-4" />}
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            leadingIcon={<ShieldCheck className="h-4 w-4" />}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-danger/15 bg-danger-soft px-3.5 py-3 text-xs leading-5 text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{formError}</p>
            </div>
          ) : null}

          <Button type="submit" size="lg" loading={isSubmitting} className="w-full justify-between">
            <span>{isSubmitting ? 'Updating…' : 'Update password'}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  )
}
