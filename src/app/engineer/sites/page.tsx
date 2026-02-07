'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Site } from '@/lib/types'
import Link from 'next/link'
import { AuthGuard } from '@/components/auth-guard'
import { DashboardLayout } from '@/components/dashboard-layout'
import { SectionHeading } from '@/components/SectionHeading'
import { asArray } from '@/lib/safe'

// Maximum time to wait for API response (in ms)
const LOADING_TIMEOUT = 5000

export default function EngineerSitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    
    const fetchSites = async () => {
      // Set a timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        setLoading(false)
        setError('Loading took too long. Please refresh the page.')
      }, LOADING_TIMEOUT)
      
      try {
        const res = await api.get('/sites')
        if (timeoutId) clearTimeout(timeoutId)
        setSites(asArray<Site>(res.data))
        setError(null)
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId)
        console.error('Failed to fetch assigned sites:', err)
        if (err.response?.status === 401) {
          setError('Session expired. Please log in again.')
        } else {
          setError('Failed to load your assigned sites. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchSites()
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  if (loading) {
    return (
      <AuthGuard allowedRoles={['engineer']}>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-slate-500">Loading your sites...</p>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  if (error) {
    return (
      <AuthGuard allowedRoles={['engineer']}>
        <DashboardLayout>
          <div className="space-y-8">
            <SectionHeading subtitle="Select a site to submit a new QA report">
              Your Assigned Sites
            </SectionHeading>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-semibold text-red-900 mb-2">Unable to Load Sites</h3>
              <p className="text-red-700 text-sm mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard allowedRoles={['engineer']}>
      <DashboardLayout>
        <div className="space-y-8">
          <SectionHeading subtitle="Select a site to submit a new QA report">
            Your Assigned Sites
          </SectionHeading>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sites.length > 0 ? (
              sites.map(site => (
                <div key={site._id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{site.name}</h3>
                        <p className="text-slate-500 text-sm">{site.location}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        site.status === 'on-track' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {site.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-4">{site.description}</p>
                  </div>
                  
                  <Link 
                    href={`/engineer/new-report?siteId=${site._id}`}
                    className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg font-medium text-center hover:bg-blue-700 transition-colors"
                  >
                    Start QA Report
                  </Link>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <div className="max-w-md mx-auto">
                  <svg 
                    className="w-16 h-16 mx-auto mb-4 text-slate-300" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5} 
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
                    />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Sites Assigned Yet</h3>
                  <p className="text-slate-500 text-sm">
                    You don&apos;t have any construction sites assigned to you at the moment.
                  </p>
                  <p className="text-slate-400 text-xs mt-3">
                    Contact your administrator if this doesn&apos;t look right.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  )
}
