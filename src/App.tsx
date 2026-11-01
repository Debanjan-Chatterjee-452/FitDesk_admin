import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { installAdminSyncBridge } from '@/lib/sync'
import { AppShell } from '@/components/layout/AppShell'
import { FullPageLoader } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { MembersPage } from '@/pages/MembersPage'
import { PackagesPage } from '@/pages/PackagesPage'
import { PaymentSettingsPage } from '@/pages/PaymentSettingsPage'
import { AttendancePage } from '@/pages/AttendancePage'
import { ProfilePage } from '@/pages/ProfilePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!session.isAdmin) return <Navigate to="/onboarding" replace />
  return <AppShell />
}

function OnboardingRoute() {
  const { session, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (session.isAdmin) return <Navigate to="/dashboard" replace />
  return <OnboardingPage />
}

function BootErrorScreen() {
  const { bootError, retryBoot } = useAuth()
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-7 shadow-card">
        <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-danger-soft text-danger">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-[-0.03em]">Could not open the workspace</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{bootError}</p>
        <Button className="mt-5" icon={<RefreshCw className="h-4 w-4" />} onClick={retryBoot}>
          Try again
        </Button>
      </div>
    </div>
  )
}

function LoginRedirect() {
  return <Navigate to="/login" replace />
}

export default function App() {
  const { bootError } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => installAdminSyncBridge(queryClient), [queryClient])

  useEffect(() => {
    if (bootError) navigate('/login', { replace: true })
  }, [bootError, navigate])

  if (bootError) return <BootErrorScreen />

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/payments" element={<PaymentSettingsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/index.html" element={<LoginRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0A2A22',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '14px',
            fontSize: '13px',
            boxShadow: '0 18px 48px -24px rgba(10,42,34,0.6)',
          },
        }}
      />
    </>
  )
}
