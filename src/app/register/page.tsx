'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-fabric px-4 py-12">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 ease-soft">
        <div className="tactile-card p-10 bg-white/80 backdrop-blur-md text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Registration Disabled</h1>
          <p className="text-slate-500 font-medium mb-6">
            Public registration is not available. Please contact your administrator to request access.
          </p>
          <p className="text-sm text-slate-400">
            Redirecting to login...
          </p>
        </div>
      </div>
    </div>
  )
}
