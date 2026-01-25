'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showBootstrapSuccess, setShowBootstrapSuccess] = useState(false)
  const { login, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('bootstrapped') === 'true') {
      setShowBootstrapSuccess(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (user) {
      router.push(user.role === 'admin' ? '/admin' : '/engineer')
    }
  }, [user, router])

  if (user) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-fabric px-4 py-12">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 ease-soft">
        <div className="tactile-card p-10 bg-white/80 backdrop-blur-md">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-soft transition-transform hover:scale-105 duration-300">
              <svg className="w-8 h-8 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Construction Quality Pulse</h1>
            <p className="text-slate-500 mt-2 font-medium">Professional QA Inspection System</p>
          </div>

          {showBootstrapSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-green-800">
                  <p className="font-semibold">System Initialized Successfully</p>
                  <p className="mt-1">Your administrator account has been created. Please sign in to continue.</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-8 p-4 bg-red-50/50 border border-red-100 rounded-xl text-sm text-red-600 animate-in fade-in zoom-in-95 duration-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 ml-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-refined"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 ml-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-refined"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-refined w-full text-base py-3"
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-400 font-medium">
              Contact your administrator to request access
            </p>
          </div>
        </div>
        
        <p className="mt-8 text-center text-xs text-slate-400 font-medium tracking-widest uppercase">
          Enterprise Security Protocol Active
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-fabric">
        <div className="text-slate-500">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
