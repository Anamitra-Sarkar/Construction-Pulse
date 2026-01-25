'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode
  allowedRoles?: ('admin' | 'engineer')[]
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }

    if (!loading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      router.push(user.role === 'admin' ? '/admin' : '/engineer')
    }
  }, [user, loading, router, allowedRoles, pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null
  }

  return <>{children}</>
}
