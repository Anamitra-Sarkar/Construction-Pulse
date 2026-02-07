'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { DEFAULT_CHECKLIST, Site } from '@/lib/types'
import { toast } from 'sonner'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/dashboard-layout'
import { SectionHeading } from '@/components/SectionHeading'
import Link from 'next/link'
import { asArray } from '@/lib/safe'

// Maximum time to wait for API response before showing error state (in ms)
const LOADING_TIMEOUT = 5000

function NewReportForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const siteId = searchParams.get('siteId')
  
  const [site, setSite] = useState<Site | null>(null)
  const [assignedSites, setAssignedSites] = useState<Site[]>([])
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST)
  const [photos, setPhotos] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingState, setFetchingState] = useState<'idle' | 'loading' | 'success' | 'error' | 'no-site'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    const fetchData = async () => {
      // If no siteId provided, load available sites for selection
      if (!siteId) {
        setFetchingState('loading')
        
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          setFetchingState('error')
          setErrorMessage('Loading took too long. Please refresh the page or try again later.')
        }, LOADING_TIMEOUT)

        try {
          const res = await api.get('/sites')
          const sites = asArray<Site>(res.data)
          
          if (timeoutId) clearTimeout(timeoutId)
          
          setAssignedSites(sites)
          if (sites.length === 0) {
            setFetchingState('no-site')
          } else {
            setFetchingState('success')
          }
        } catch (error: any) {
          if (timeoutId) clearTimeout(timeoutId)
          console.error('Failed to fetch assigned sites:', error)
          
          if (error.response?.status === 401) {
            setErrorMessage('Session expired. Please log in again.')
          } else if (error.response?.status === 404) {
            setErrorMessage('Sites service is unavailable. Please try again later.')
          } else {
            setErrorMessage('Failed to load your assigned sites. Please try again.')
          }
          setFetchingState('error')
        }
        return
      }

      // If siteId is provided, fetch that specific site
      setFetchingState('loading')
      
      // Set a timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        setFetchingState('error')
        setErrorMessage('Loading took too long. Please refresh the page or try again later.')
      }, LOADING_TIMEOUT)

      try {
        const res = await api.get(`/sites/${siteId}`)
        
        if (timeoutId) clearTimeout(timeoutId)
        
        if (res.data) {
          setSite(res.data)
          setFetchingState('success')
        } else {
          setFetchingState('error')
          setErrorMessage('Site not found. Please select a valid site.')
        }
      } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId)
        console.error('Failed to fetch site:', error)
        
        if (error.response?.status === 401) {
          setErrorMessage('Session expired. Please log in again.')
        } else if (error.response?.status === 404) {
          setErrorMessage('Site not found. It may have been removed or you may not have access.')
        } else {
          setErrorMessage('Failed to load site details. Please try again.')
        }
        setFetchingState('error')
      }
    }

    fetchData()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [siteId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!siteId) return
    
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('siteId', siteId)
      formData.append('checklist', JSON.stringify(checklist))
      photos.forEach(photo => formData.append('photos', photo))

      await api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      toast.success('QA Report submitted successfully')
      router.push('/engineer/reports')
    } catch (error) {
      console.error('Failed to submit report:', error)
      toast.error('Failed to submit report')
    } finally {
      setLoading(false)
    }
  }

  const updateChecklist = (index: number, status: 'pass' | 'fail' | 'n/a') => {
    const newChecklist = [...checklist]
    newChecklist[index].status = status
    setChecklist(newChecklist)
  }

  // Show loading state (with timeout protection)
  if (fetchingState === 'loading' || fetchingState === 'idle') {
    return (
      <AuthGuard allowedRoles={['engineer']}>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  // Show error state
  if (fetchingState === 'error') {
    return (
      <AuthGuard allowedRoles={['engineer']}>
        <DashboardLayout>
          <div className="max-w-2xl mx-auto">
            <SectionHeading subtitle="Unable to proceed with report">
              New QA Report
            </SectionHeading>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-semibold text-red-900 mb-2">Error Loading Page</h3>
              <p className="text-red-700 text-sm mb-6">{errorMessage}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
                <Link
                  href="/engineer/sites"
                  className="px-4 py-2 border border-red-200 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors"
                >
                  View My Sites
                </Link>
              </div>
            </div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  // Show no sites assigned state
  if (fetchingState === 'no-site') {
    return (
      <AuthGuard allowedRoles={['engineer']}>
        <DashboardLayout>
          <div className="max-w-2xl mx-auto">
            <SectionHeading subtitle="Select a site to create a report">
              New QA Report
            </SectionHeading>
            
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Sites Assigned</h3>
              <p className="text-slate-500 text-sm mb-2">
                You don&apos;t have any construction sites assigned to you yet.
              </p>
              <p className="text-slate-400 text-xs mb-6">
                Contact your administrator to get assigned to a site.
              </p>
              <Link
                href="/engineer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  // Show site selection if no siteId provided but sites are available
  if (!siteId && assignedSites.length > 0) {
    return (
      <AuthGuard allowedRoles={['engineer']}>
        <DashboardLayout>
          <div className="max-w-3xl mx-auto">
            <SectionHeading subtitle="Select a site to create a QA report">
              New QA Report
            </SectionHeading>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedSites.map((s) => (
                <Link
                  key={s._id}
                  href={`/engineer/new-report?siteId=${s._id}`}
                  className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{s.name}</h3>
                      <p className="text-sm text-slate-500">{s.location}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      s.status === 'on-track' ? 'bg-green-100 text-green-700' :
                      s.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
                      s.status === 'delayed' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {s.status?.replace('-', ' ').replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Compliance: {s.complianceScore?.toFixed(0) ?? 0}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  // Show report form if site is loaded
  if (!site) {
    // This shouldn't happen, but safety check
    return (
      <AuthGuard allowedRoles={['engineer']}>
        <DashboardLayout>
          <div className="flex justify-center py-12">
            <p className="text-slate-500">Unable to load site. Please try again.</p>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard allowedRoles={['engineer']}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-8">
          <SectionHeading subtitle={`Site: ${site.name} | ${site.location}`}>
            New QA Report
          </SectionHeading>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Inspection Item</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {checklist.map((item, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 text-sm text-slate-900">{item.item}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {['pass', 'fail', 'n/a'].map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateChecklist(i, status as any)}
                          className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                            item.status === status 
                              ? (status === 'pass' ? 'bg-green-600 text-white' : status === 'fail' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white')
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {status.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-slate-900">Upload Site Photos (Max 5)</h3>
          <input 
            type="file" 
            multiple 
            accept="image/*"
            onChange={e => setPhotos(Array.from(e.target.files || []))}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="flex gap-4">
          <button 
            type="button" 
            onClick={() => router.back()}
            className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit QA Report'}
          </button>
        </div>
      </form>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}

export default function NewReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewReportForm />
    </Suspense>
  )
}
