import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { SidebarContent } from './SidebarContent'
import { MobileTopbar } from './MobileTopbar'
import { ConfirmDialog } from '@/components/ui/Modal'
import { NotificationBell } from '@/components/ui/NotificationBell'

export function AppShell() {
  const { session, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  if (!session) return null

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
      setSignOutOpen(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] lg:block">
        <SidebarContent
          profile={session.profile}
          email={session.email}
          gymName={session.gymName}
          onSignOut={() => setSignOutOpen(true)}
        />
      </aside>

      <MobileTopbar onMenu={() => setDrawerOpen(true)} />

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-primary-ink/50 backdrop-blur-[2px]"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-[290px] max-w-[86vw] animate-scale-in shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent
              profile={session.profile}
              email={session.email}
              gymName={session.gymName}
              onNavigate={() => setDrawerOpen(false)}
              onSignOut={() => {
                setDrawerOpen(false)
                setSignOutOpen(true)
              }}
            />
          </div>
        </div>
      ) : null}

      <main className="min-h-screen lg:pl-[272px]">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
          <div className="mb-4 flex justify-end lg:mb-6">
            <NotificationBell />
          </div>
          <Outlet />
        </div>
      </main>

      <ConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={handleSignOut}
        loading={signingOut}
        title="Sign out of FitDesk Admin?"
        description="Your saved browser password will stay in your password manager. You will need the preset password to return."
        confirmLabel="Sign out"
        tone="primary"
      />
    </div>
  )
}
