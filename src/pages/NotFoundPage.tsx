import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Error 404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">That page is off the floor.</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          The link may be old, or the page may have moved inside the admin suite.
        </p>
        <Link
          to="/dashboard"
          className="focus-ring mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink transition hover:bg-primary-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>
      </div>
    </div>
  )
}
