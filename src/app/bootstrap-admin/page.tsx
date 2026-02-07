'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { apiBaseUrl } from '@/lib/api-url'

export default function BootstrapAdminPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkSystemStatus()
  }, [])

  const checkSystemStatus = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/governance/status`)
      // Use `bootstrapped` as primary field (source of truth from SystemSettings),
      // fall back to `initialized` for backward compatibility
      setInitialized(res.data.bootstrapped ?? res.data.initialized)
    } catch (error) {
      console.error('Failed to check system status:', error)
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await axios.post(`${apiBaseUrl}/governance/bootstrap-admin`, {
        email,
        password,
        name
      })
      router.push('/login?bootstrapped=true')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create bootstrap admin')
    } finally {
      setLoading(false)
    }
  }

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fabric px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-500 font-medium">Checking system status...</p>
        </div>
      </div>
    )
  }

  if (initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fabric px-4 py-12">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 ease-soft">
          <div className="tactile-card p-10 bg-white/80 backdrop-blur-md text-center">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">System Already Initialized</h1>
            <p className="text-slate-500 font-medium mb-6">
              An administrator account has already been created. Bootstrap is permanently disabled for security.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="btn-refined w-full"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-fabric px-4 py-12">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 ease-soft">
        <div className="tactile-card p-10 bg-white/80 backdrop-blur-md">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-soft">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Bootstrap</h1>
            <p className="text-slate-500 mt-2 font-medium">Create the first administrator account</p>
          </div>

          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-semibold">One-Time Setup</p>
                <p className="mt-1">This page will be permanently disabled after creating the first admin account.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 animate-in fade-in zoom-in-95 duration-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 ml-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input-refined"
                placeholder="Administrator Name"
              />
            </div>

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
                placeholder="admin@company.com"
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
                minLength={6}
                className="input-refined"
                placeholder="Create a secure password"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 ml-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input-refined"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-refined w-full text-base py-3 mt-4"
            >
              {loading ? 'Creating Admin Account...' : 'Initialize System'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 font-medium tracking-widest uppercase">
          Secure Enterprise Bootstrap
        </p>
      </div>
    </div>
  )
}
