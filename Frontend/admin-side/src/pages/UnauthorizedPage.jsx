import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ShieldAlert, ArrowRight } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <>
      <Helmet>
        <title>Access Denied — Vatvruksha Admin</title>
      </Helmet>

      <div className="mx-auto w-full max-w-md px-3 py-10 text-center sm:px-6 sm:py-16">
        <ShieldAlert className="mx-auto mb-5 text-red-600 sm:mb-6" size={48} />
        <h1 className="mb-3 font-serif text-2xl text-brown sm:text-3xl">Access Denied</h1>
        <p className="mx-auto mb-6 max-w-sm break-words text-sm leading-6 text-brown-light sm:text-base">
          Your account does not have admin access, or your email is not verified.
          Please contact an administrator to request the admin role, then verify
          your email and sign in again.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/admin/login"
            className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 py-3 sm:w-auto"
          >
            <ArrowRight size={16} /> Sign In Again
          </Link>
        </div>
      </div>
    </>
  )
}
