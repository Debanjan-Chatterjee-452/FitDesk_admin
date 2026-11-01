import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AdminSession } from '@/lib/api/auth'
import {
  refreshAdminProfile,
  restoreAdminSession,
  signInAdmin,
  signOutAdmin,
} from '@/lib/api/auth'
import { toAppError } from '@/lib/errors'

interface AuthContextValue {
  session: AdminSession | null
  loading: boolean
  bootError: string | null
  signIn: (email: string, password: string) => Promise<AdminSession>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  reload: () => Promise<void>
  retryBoot: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)
  const [bootAttempt, setBootAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setBootError(null)

    restoreAdminSession()
      .then((next) => {
        if (active) setSession(next)
      })
      .catch((error) => {
        if (active) setBootError(toAppError(error).message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [bootAttempt])

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await signInAdmin(email, password)
    setSession(next)
    return next
  }, [])

  const signOut = useCallback(async () => {
    try {
      await signOutAdmin()
    } finally {
      setSession(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session) return
    const profile = await refreshAdminProfile(session.userId)
    setSession((current) => (current ? { ...current, profile } : current))
  }, [session])

  const retryBoot = useCallback(() => setBootAttempt((value) => value + 1), [])

  const reload = useCallback(async () => {
    const next = await restoreAdminSession()
    setSession(next)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      bootError,
      signIn,
      signOut,
      refreshProfile,
      reload,
      retryBoot,
    }),
    [session, loading, bootError, signIn, signOut, refreshProfile, reload, retryBoot],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
